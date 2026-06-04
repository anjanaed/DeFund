import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUpdateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;
}
