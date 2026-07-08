import { nanoid } from 'nanoid';

export function newResearchId(): string {
  return `res_${nanoid()}`;
}

export function newTestRunId(): string {
  return `run_${nanoid()}`;
}

export function newProgressId(): string {
  return `prog_${nanoid()}`;
}
