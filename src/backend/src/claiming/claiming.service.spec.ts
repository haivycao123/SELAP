import { Test, TestingModule } from '@nestjs/testing';
import { ClaimingService } from './claiming.service';

describe('ClaimingService', () => {
  let service: ClaimingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaimingService],
    }).compile();

    service = module.get<ClaimingService>(ClaimingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
