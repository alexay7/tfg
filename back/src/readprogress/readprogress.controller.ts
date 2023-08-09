import {
    Controller,
    Req,
    Post,
    Get,
    Body,
    UseGuards,
    Query,
    UnauthorizedException,
    BadRequestException,
    HttpStatus,
    Param,
    Delete,
    Patch,
    Inject
} from "@nestjs/common";
import {ReadprogressService} from "./readprogress.service";
import {ProgressDto} from "./dto/create-readprogress.dto";
import {Request} from "express";
import {JwtAuthGuard} from "../auth/strategies/jwt.strategy";
import {Types} from "mongoose";
import {
    CreateReadProgress
} from "./interfaces/readprogress.interface";
import {ReadlistService} from "../readlist/readlist.service";
import {ReadProgress, ReadProgressStatus} from "./schemas/readprogress.schema";
import {BooksService} from "../books/books.service";
import {ParseObjectIdPipe} from "../validation/objectId";
import {ApiOkResponse, ApiTags} from "@nestjs/swagger";
import {CACHE_MANAGER} from "@nestjs/cache-manager";
import {Cache} from "cache-manager";
import {SerieprogressService} from "../serieprogress/serieprogress.service";
import {FullSerieProgress} from "../serieprogress/interfaces/serieprogress";
import {Book} from "../books/schemas/book.schema";

@Controller("readprogress")
@ApiTags("Progresos de Lectura")
@UseGuards(JwtAuthGuard)
export class ReadprogressController {
    constructor(
        private readonly readprogressService: ReadprogressService,
        private readonly readListService: ReadlistService,
        private readonly booksService:BooksService,
        private readonly serieProgressService:SerieprogressService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache
    ) {}

    @Post()
    @ApiOkResponse({status:HttpStatus.OK})
    async modifyOrCreateProgress(@Req() req:Request, @Body() progressDto:ProgressDto):Promise<ReadProgress | null> {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId: Types.ObjectId};

        const foundProgress = await this.readprogressService.findProgressByBookAndUser(progressDto.book, userId);

        if (progressDto.status !== "reading" && foundProgress?.status === progressDto.status) return null;

        const foundBook = await this.booksService.findById(progressDto.book);

        if (!foundBook) throw new BadRequestException();

        if (progressDto.status !== "unread") {
            // Si el progreso es avanzar la lectura, quitarlo de la lista de lectura si existe

            await this.serieProgressService.createOrIncreaseBooks({
                serie:foundBook.serie,
                book:progressDto.book,
                user:userId,
                action:"add"});

            const foundReadList = await this.readListService.findSerieInReadList(userId, foundBook?.serie);
      
            if (foundReadList) {
                await this.readListService.removeSerieWithId(foundReadList._id);
            }
        } else {
            await this.serieProgressService.createOrIncreaseBooks({
                serie:foundBook.serie,
                book:progressDto.book,
                user:userId,
                action:"remove"});
        }

        if (!foundProgress || foundProgress.status === "completed") {
            // No se ha encontrado progreso ninguno o el ultimo proceso es de completado, se crea uno nuevo

            const newProgress:CreateReadProgress = {
                user:userId,
                ...progressDto,
                serie:foundBook.serie,
                startDate:new Date(),
                lastUpdateDate:new Date()
            };

            return this.readprogressService.createReadProgress(newProgress);
        }

        // Se ha encontrado un proceso con estado de reading o unread, se actualizan los datos
        return this.readprogressService.modifyReadProgress(foundProgress._id as Types.ObjectId, {...progressDto, lastUpdateDate:new Date()});
    }

    @Post(":serieId")
    async setSerieAsRead(@Req() req:Request, @Param("serieId", ParseObjectIdPipe) serieId:Types.ObjectId) {
        const found = await this.booksService.getSerieBooks(serieId);

        found.forEach(async(book)=>{
            await this.modifyOrCreateProgress(req, {book:book._id, status:"completed", currentPage:book.pages, endDate:new Date()});
        });

        return {status:"OK"};
    }

    @Get()
    @ApiOkResponse({status:HttpStatus.OK})
    async getReadProgress(@Req() req:Request, @Query("book", ParseObjectIdPipe) book:Types.ObjectId, @Query("status") status?:ReadProgressStatus) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId: Types.ObjectId};

        const found = await this.readprogressService.findProgressByBookAndUser(book, userId, status);

        if (found) return found;

        return {};
    }

    @Get("all")
    @ApiOkResponse({status:HttpStatus.OK})
    async getAllReadProgress(@Req() req:Request) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};

        const cached = await this.cacheManager.get(`${userId}-${req.url}`);
        if (cached) {
            return cached;
        }

        const response = await this.readprogressService.findUserProgresses(userId);

        await this.cacheManager.set(`${userId}-${req.url}`, response);

        return response;
    }

    @Get("tablero")
    @ApiOkResponse({status:HttpStatus.OK})
    async getSeriesProgress(@Req() req:Request) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};

        const cached = await this.cacheManager.get(`${userId}-${req.url}`);
        if (cached) {
            return cached;
        }

        const series:FullSerieProgress[] = await this.serieProgressService.getUserSeriesProgress(userId);
        const readingSeries = (await this.readprogressService.getReadingSeries(userId)).map(x=>x.serie.toString());

        const returnBooks:Book[] = [];

        series.forEach((serie)=>{
            if (serie.readBooks.length === 0 || serie.readBooks.length === serie.serieBooks.length || serie.paused || 
                readingSeries.indexOf(serie.serie.toString()) !== -1) return;

            const unreadBooks = serie.serieBooks.filter(
                x=>serie.readBooks.findIndex(
                    y=>y._id.equals(x._id as Types.ObjectId)
                ) === -1
            ).sort((a, b)=>{
                if (a.sortName < b.sortName) {
                    return -1;
                } else {
                    return 1;
                }
            });

            returnBooks.push(unreadBooks[0]);
        });

        await this.cacheManager.set(`${userId}-${req.url}`, returnBooks);

        return returnBooks;
    }

    @Get("reading")
    async getReading(@Req() req:Request) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};

        const cached = await this.cacheManager.get(`${userId}-${req.url}`);
        if (cached) {
            return cached;
        }

        const response = await this.readprogressService.getReadingBooks(userId);

        await this.cacheManager.set(`${userId}-${req.url}`, response);

        return response;
    }

    @Patch("serie/:serieId/pause")
    async pauseSerie(@Req() req:Request, @Param("serieId", ParseObjectIdPipe) serie:Types.ObjectId) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};

        await this.readprogressService.modifyWholeSerie(serie, userId, true);
        return {status:"OK"};
    }

    @Patch("serie/:serieId/resume")
    async resumeSerie(@Req() req:Request, @Param("serieId", ParseObjectIdPipe) serie:Types.ObjectId) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};

        await this.readprogressService.modifyWholeSerie(serie, userId, false);
        return {status:"OK"};
    }

    @Delete(":id")
    async deleteReadProgress(@Req() req:Request, @Param("id", ParseObjectIdPipe) id:Types.ObjectId) {
        if (!req.user) throw new UnauthorizedException();

        const {userId} = req.user as {userId:Types.ObjectId};
        
        return this.readprogressService.deleteReadProgress(id, userId);
    }
}
