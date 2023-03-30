import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    type: String,
    nullable: false
  })
  title: string;

  @ApiProperty({
    type: [String],
    nullable: false
  })
  content: Array<string>;

  @ApiProperty({
    type: 'uuidv4',
    nullable: false
  })
  userId: string;
}
