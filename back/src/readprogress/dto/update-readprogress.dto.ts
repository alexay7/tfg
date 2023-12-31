import {IsDateString, IsNumber, IsOptional, IsString} from "class-validator";
import {ReadProgressStatus} from "../schemas/readprogress.schema";

export class UpdateReadProgressDto {
    @IsNumber()
    @IsOptional()
    time?: number;
  
    @IsNumber()
    @IsOptional()
    currentPage?: number;

    @IsNumber()
    @IsOptional()
    characters?: number;
  
    @IsDateString()
    @IsOptional()
    startDate?: Date;
  
    @IsDateString()
    @IsOptional()
    endDate?: Date;
  
    @IsString()
    @IsOptional()
    status?: ReadProgressStatus;
}
  