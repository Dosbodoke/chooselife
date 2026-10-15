import { getIsaLinkErrorKey } from './isa-link-error';

describe('getIsaLinkErrorKey', () => {
  it('explains an ISA account that belongs to another profile', () => {
    expect(getIsaLinkErrorKey(409)).toBe('alreadyLinked');
  });

  it('explains an ISA sign-in that could not be verified', () => {
    expect(getIsaLinkErrorKey(401)).toBe('notVerified');
  });

  it('falls back to a generic failure', () => {
    expect(getIsaLinkErrorKey(502)).toBe('linkFailed');
    expect(getIsaLinkErrorKey(undefined)).toBe('linkFailed');
  });
});
