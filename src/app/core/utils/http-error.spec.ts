import { HttpErrorResponse } from '@angular/common/http';
import {
  describeHttpError,
  extractServerMessages,
  httpStatusOf,
  isUnreachable,
} from './http-error';

describe('describeHttpError', () => {
  it('explains network failures', () => {
    expect(describeHttpError(new HttpErrorResponse({ status: 0 }))).toContain(
      'could not reach the server',
    );
  });

  it('prefers the message in a Spring ApiError body', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        timestamp: 'now',
        status: 409,
        error: 'Conflict',
        message: 'Insufficient funds',
        path: '/api/clients/1/withdraw',
      },
    });
    expect(describeHttpError(error)).toBe('Insufficient funds');
  });

  it('joins NestJS validation message arrays', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        statusCode: 400,
        message: ['email must be an email', 'password should not be empty'],
      },
    });
    expect(describeHttpError(error)).toBe('email must be an email password should not be empty');
  });

  it('falls back to a role explanation for 403 and a generic sentence otherwise', () => {
    expect(describeHttpError(new HttpErrorResponse({ status: 403 }))).toContain('role');
    expect(describeHttpError(new HttpErrorResponse({ status: 500 }))).toContain(
      'server ran into a problem',
    );
    expect(describeHttpError(new Error('boom'))).toBe('boom');
    expect(describeHttpError('???', 'fallback')).toBe('fallback');
  });

  it('points at the backend services when the proxy cannot reach them', () => {
    expect(describeHttpError(new HttpErrorResponse({ status: 502 }))).toContain(
      'could not be reached',
    );
    expect(describeHttpError(new HttpErrorResponse({ status: 504 }))).toContain('port 3000');
    expect(isUnreachable(new HttpErrorResponse({ status: 504 }))).toBe(true);
    expect(isUnreachable(new HttpErrorResponse({ status: 0 }))).toBe(true);
    expect(isUnreachable(new HttpErrorResponse({ status: 401 }))).toBe(false);
  });

  it('exposes the status code when present', () => {
    expect(httpStatusOf(new HttpErrorResponse({ status: 404 }))).toBe(404);
    expect(httpStatusOf(new Error('x'))).toBeNull();
  });

  it('lists every server message individually', () => {
    expect(
      extractServerMessages(
        new HttpErrorResponse({ status: 400, error: { message: ['a', ' b ', 3] } }),
      ),
    ).toEqual(['a', 'b']);
    expect(
      extractServerMessages(
        new HttpErrorResponse({
          status: 409,
          error: { message: 'Client with this email already exists' },
        }),
      ),
    ).toEqual(['Client with this email already exists']);
    expect(
      extractServerMessages(new HttpErrorResponse({ status: 504, error: 'Gateway Timeout' })),
    ).toEqual(['Gateway Timeout']);
    expect(extractServerMessages(new Error('x'))).toEqual([]);
  });
});
