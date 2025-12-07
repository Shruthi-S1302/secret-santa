import { TestBed } from '@angular/core/testing';

import { People } from './people';

describe('People', () => {
  let service: People;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(People);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
