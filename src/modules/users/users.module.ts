import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './controllers/users.controller.js';
import { User } from './entities/user.entity.js';
import { UsersProvider } from './services/users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersProvider],
  exports: [UsersProvider],
})
export class UsersModule {}
