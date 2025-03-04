import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class OpenAiRequestDto {
  @IsString()
  @IsNotEmpty()
  userProfession: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;
  
  @IsString()
  @IsOptional()
  topic?: string;
}
