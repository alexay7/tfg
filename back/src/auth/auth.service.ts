import {
    Injectable,
    BadRequestException,
    ForbiddenException
} from "@nestjs/common";
import {UsersService} from "../users/users.service";
import {JwtService} from "@nestjs/jwt";
import * as argon2 from "argon2";
import {CreateUserDto} from "../users/dto/create-user.dto";
import {hashData} from "./helpers/helper";
import {AuthDto} from "./dto/auth.dto";
import {TokensService} from "../tokens/tokens.service";
import {Types} from "mongoose";
import {randomUUID} from "crypto";
import {ConfigService} from "@nestjs/config";
import {User} from "../users/schemas/user.schema";

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly tokensService: TokensService,
        private readonly configService: ConfigService
    ) {}

    // INICIO FUNCIONES RELACIONADAS CON TOKENS
    async updateRefreshToken(
        uuid: string,
        user: Types.ObjectId,
        newRefreshToken: string
    ) {
    // Hashea el token antes de guardarlo en la base de datos
        const hashedRefreshToken = await hashData(newRefreshToken);

        await this.tokensService.updateOrCreateToken(
            uuid,
            user,
            hashedRefreshToken
        );
    }

    async getTokens(uuid: string, user: string) {
    // Firma los nuevos tokens de acceso y refresca con el id del usuario y el uuid del dispositivo
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(
                {
                    sub: user.toString(),
                    uuid
                },
                {
                    secret: this.configService.get<string>("ACCESS_SECRET"),
                    /**
           * El frontend enviará una petición cada 59 minutos para renovar el token.
           * Es un valor relativamente alto para un token de acceso, pero al ser
           * un servidor en el que se pretende que los usuarios pasen sesiones largas de tiempo leyendo
           * sin hacer peticiones directas (serán peticiones del html mediante los src de los tags <img>),
           * poner un valor pequeño provocaría muchas peticiones.
           */
                    expiresIn: "1h"
                }
            ),
            this.jwtService.signAsync(
                {
                    sub: user.toString(),
                    uuid
                },
                {
                    secret: this.configService.get<string>("REFRESH_SECRET"),
                    // TODO: ajustar esto para que exista un rememberme que dure 1 mes
                    expiresIn: "7d"
                }
            )
        ]);

        return {
            uuid,
            accessToken,
            refreshToken
        };
    }

    async renewTokens(
        uuid: string,
        user: Types.ObjectId,
        refreshToken: string
    ): Promise<{uuid: string; accessToken: string; refreshToken: string}> {
        const userToken = await this.tokensService.findToken(uuid, user);

        // No se ha encontrado refresh token para este dispositivo, mandar al usuario al login
        if (!userToken) throw new ForbiddenException();

        const tokensMatch = await argon2.verify(
            userToken.refreshToken || "",
            refreshToken
        );

        // El token no es el guardado en la base de datos, mandar al usuario al login
        if (!tokensMatch) throw new ForbiddenException();

        // Generar nuevos tokens
        const newTokens = await this.getTokens(uuid, user.toString());

        // Guardarlos en la base de datos
        await this.updateRefreshToken(uuid, user, newTokens.refreshToken);

        return newTokens;
    }
    // FIN FUNCIONES RELACIONADAS CON TOKENS

    async signUp(createUserDto: CreateUserDto): Promise<User> {
    // Comprueba si el usuario ya existe
        const userExists = await this.usersService.findByUsernameOrEmail(
            createUserDto.username
        );
        if (userExists) {
            throw new BadRequestException("User already exists");
        }

        // Hashea la contraseña con la función del helper
        const hash = await hashData(createUserDto.password);

        // Crea el nuevo usuario con la contraseña hasheada
        const newUser = await this.usersService.create({
            ...createUserDto,
            password: hash
        });

        return newUser;
    }

    async signIn(
        data: AuthDto
    ): Promise<{tokens: {uuid: string; accessToken: string; refreshToken: string};
            user: User;}> {
    // Comprueba que el usuario esté registrado
        const user = await this.usersService.findByUsernameOrEmail(data.usernameOrEmail);

        if (!user) throw new BadRequestException("User does not exist");

        // Comprueba que la contraseña introducida es correcta comparando hashes
        const passwordMatches = await argon2.verify(user.password, data.password);

        if (!passwordMatches)
            throw new BadRequestException("Password is incorrect");

        /**
     * Si el navegador envía un uuid no hace falta generar uno nuevo. Se reemplaza el token de refresco del anterior
     * Si no lo envía, generar un uuid nuevo para el dispositivo
     */
        let uuid = data.uuid;

        if (!uuid) {
            uuid = randomUUID();
        }

        // Genera los tokens de refresco para ese uuid
        const tokens = await this.getTokens(uuid, user._id);

        // Añade los tokens generados a la base de datos
        await this.updateRefreshToken(tokens.uuid, user._id, tokens.refreshToken);

        return {tokens, user: user};
    }

    async signOut(uuid: string, user: Types.ObjectId) {
    // Fuerza la recarga de los tokens de refresco a null en un único dispositivo
        return this.tokensService.updateOrCreateToken(uuid, user, null);
    }
}
