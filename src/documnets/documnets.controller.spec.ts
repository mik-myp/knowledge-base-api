import { Test, TestingModule } from '@nestjs/testing';
import { DocumnetsController } from './documnets.controller';
import { DocumnetsService } from './documnets.service';

describe('DocumnetsController', () => {
  let controller: DocumnetsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumnetsController],
      providers: [DocumnetsService],
    }).compile();

    controller = module.get<DocumnetsController>(DocumnetsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
