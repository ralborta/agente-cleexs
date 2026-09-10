import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPrivateHostnameOrIp, isPrivateIp, safeFetchPage } from '../safe-fetch';

describe('safe-fetch private IP blocking', () => {
  it('isPrivateIp covers RFC1918, loopback, link-local, metadata', () => {
    assert.equal(isPrivateIp('10.1.2.3'), true);
    assert.equal(isPrivateIp('172.31.255.1'), true);
    assert.equal(isPrivateIp('172.15.0.1'), false);
    assert.equal(isPrivateIp('192.168.100.1'), true);
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('169.254.169.254'), true);
    assert.equal(isPrivateIp('8.8.4.4'), false);
  });

  it('isPrivateHostnameOrIp blocks localhost aliases', () => {
    assert.equal(isPrivateHostnameOrIp('localhost'), true);
    assert.equal(isPrivateHostnameOrIp('foo.localhost'), true);
    assert.equal(isPrivateHostnameOrIp('127.0.0.1'), true);
    assert.equal(isPrivateHostnameOrIp('[::1]'), true);
  });

  it('safeFetchPage rejects private IP URLs without contacting network meaningfully', async () => {
    const res = await safeFetchPage('http://127.0.0.1/', { timeoutMs: 2000 });
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /privada|bloqueado|privado|local/i);
  });

  it('safeFetchPage rejects non-http schemes', async () => {
    const res = await safeFetchPage('file:///etc/passwd');
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /http/i);
  });
});
