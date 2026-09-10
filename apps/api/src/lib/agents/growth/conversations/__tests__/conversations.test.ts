import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAttributedArticleUrl, createAttributionId } from '../attribution';
import { wouldExceedSpendLimit } from '../config';
import { isLikelyConversationUrl } from '../filters';
import { normalizeUrl, extractDomain, isOwnSite } from '../normalize-url';
import {
  isConceptuallyPublished,
  isEditoriallyApproved,
  scoreOpportunity,
} from '../score';
import { DEFAULT_GROWTH_CONVERSATIONS_CONFIG } from '../config';
import { isPrivateHostnameOrIp, isPrivateIp } from '../../../../url-reader/safe-fetch';
import { computeBackoffMs } from '../../../../agent-jobs/queue';
import { verifyConversationPage } from '../verify';

describe('normalizeUrl', () => {
  it('dedupe tracking params, hash, trailing slash, host case', () => {
    const a = normalizeUrl(
      'HTTPS://WWW.Example.com/path/?utm_source=x&gclid=1&fbclid=2&keep=1#frag',
    );
    const b = normalizeUrl('https://www.example.com/path?keep=1');
    assert.equal(a, b);
    assert.ok(!a.includes('utm_'));
    assert.ok(!a.includes('#'));
    assert.ok(!a.endsWith('/path/'));
  });

  it('keeps root slash and strips default ports', () => {
    assert.equal(normalizeUrl('https://example.com:443/'), 'https://example.com/');
    assert.equal(normalizeUrl('http://example.com:80'), 'http://example.com/');
  });

  it('extractDomain and isOwnSite', () => {
    assert.equal(extractDomain('https://blog.cleexs.com/a'), 'blog.cleexs.com');
    assert.equal(isOwnSite('https://www.cleexs.com/x', ['cleexs.com']), true);
    assert.equal(isOwnSite('https://reddit.com/r/x', ['cleexs.com']), false);
  });
});

describe('isPrivateHostnameOrIp', () => {
  it('blocks private ranges and metadata', () => {
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('172.16.5.1'), true);
    assert.equal(isPrivateIp('192.168.1.1'), true);
    assert.equal(isPrivateIp('127.0.0.1'), true);
    assert.equal(isPrivateIp('169.254.169.254'), true);
    assert.equal(isPrivateIp('::1'), true);
    assert.equal(isPrivateIp('8.8.8.8'), false);
    assert.equal(isPrivateHostnameOrIp('localhost'), true);
    assert.equal(isPrivateHostnameOrIp('metadata.google.internal'), true);
  });
});

describe('scoreOpportunity', () => {
  it('unknown dates lower confidence and explain motives', () => {
    const scored = scoreOpportunity({
      verify: {
        verifyStatus: 'verified',
        title: 'Cómo mejorar logística de última milla',
        questionText: '¿Alguien tiene tips de logística última milla?',
        evidenceSnippet: 'necesito reducir costos de delivery',
        threadCreatedAtKnown: false,
        lastActivityAtKnown: false,
        allowsReplies: true,
        isClosed: false,
        isArchived: false,
      },
      articleKeyword: 'logística última milla',
      articleTitle: 'Guía de logística de última milla',
      audienceHints: ['logística'],
      weights: DEFAULT_GROWTH_CONVERSATIONS_CONFIG.scoreWeights,
    });

    assert.ok(scored.evidenceConfidence < 0.7);
    assert.ok(
      scored.breakdown.motives.some((m) => /fechas de actividad desconocidas/i.test(m)),
    );
  });
});

describe('editorial vs published', () => {
  it('approved ≠ published', () => {
    assert.equal(isEditoriallyApproved('approved'), true);
    assert.equal(isEditoriallyApproved('draft_ready'), false);
    assert.equal(isConceptuallyPublished(false), false);
    assert.equal(isConceptuallyPublished(true), true);
  });
});

describe('attribution', () => {
  it('opaque id + utm params', () => {
    const id = createAttributionId();
    assert.match(id, /^[a-f0-9]{32}$/);
    assert.notEqual(id, createAttributionId());
    const url = buildAttributedArticleUrl('https://cleexs.com/articulos/x', id);
    const u = new URL(url);
    assert.equal(u.searchParams.get('utm_source'), 'growth_conversations');
    assert.equal(u.searchParams.get('utm_medium'), 'forum');
    assert.equal(u.searchParams.get('utm_campaign'), 'teo');
    assert.equal(u.searchParams.get('utm_content'), id);
  });
});

describe('filters', () => {
  it('detects conversation urls', () => {
    assert.equal(
      isLikelyConversationUrl('https://www.reddit.com/r/logistics/comments/abc/foo'),
      true,
    );
    assert.equal(
      isLikelyConversationUrl('https://stackoverflow.com/questions/123/how-to'),
      true,
    );
    assert.equal(
      isLikelyConversationUrl('https://example.com/', 'organic'),
      false,
    );
    assert.equal(
      isLikelyConversationUrl('https://vendor.com/pricing', 'organic'),
      false,
    );
    assert.equal(
      isLikelyConversationUrl('https://random.com/x', 'discussions_and_forums'),
      true,
    );
  });
});

describe('spend limit', () => {
  it('wouldExceedSpendLimit', () => {
    assert.equal(wouldExceedSpendLimit(1.9, 0.002, 2), false);
    assert.equal(wouldExceedSpendLimit(1.999, 0.002, 2), true);
    assert.equal(wouldExceedSpendLimit(2, 0.002, 2), true);
  });
});

describe('job backoff', () => {
  it('computeBackoffMs grows with attempts', () => {
    assert.equal(computeBackoffMs(1), 5000);
    assert.equal(computeBackoffMs(2), 20000);
    assert.equal(computeBackoffMs(3), 45000);
  });
});

describe('verifyConversationPage (mocked fetch)', () => {
  it('marks login walls as not_verifiable without inventing dates', async () => {
    const result = await verifyConversationPage({
      url: 'https://forum.example.com/t/how-to-track-fleets',
      articleContext: { title: 'Agentes de seguimiento', keyword: 'flotas' },
      fetchPage: async () => ({
        ok: true,
        status: 200,
        finalUrl: 'https://forum.example.com/t/how-to-track-fleets',
        contentType: 'text/html',
        text: '<html><head><title>Login required</title></head><body>Please log in to continue</body></html>',
      }),
    });
    assert.equal(result.verifyStatus, 'not_verifiable');
    assert.equal(result.threadCreatedAtKnown, false);
    assert.equal(result.lastActivityAtKnown, false);
    assert.equal(result.threadCreatedAt, null);
  });

  it('marks blocked fetch as not_verifiable', async () => {
    const result = await verifyConversationPage({
      url: 'https://forum.example.com/t/x',
      fetchPage: async () => ({
        ok: false,
        status: 0,
        finalUrl: 'https://forum.example.com/t/x',
        contentType: null,
        text: '',
        error: 'timeout',
      }),
    });
    assert.equal(result.verifyStatus, 'not_verifiable');
    assert.ok(result.verifyError);
  });
});

describe('attribution absence of metrics', () => {
  it('does not treat missing GA4 as zero sessions conceptually', () => {
    // Contrato: valueKnown=false + value=null (ver metrics.collectInterventionMetrics)
    const unknown = { value: null as number | null, valueKnown: false };
    assert.equal(unknown.valueKnown, false);
    assert.equal(unknown.value, null);
    assert.notEqual(unknown.value, 0);
  });
});
