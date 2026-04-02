import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  twitterHandle?: string;

  @IsOptional()
  @IsString()
  discordHandle?: string;

  @IsOptional()
  @IsString()
  githubHandle?: string;
}
