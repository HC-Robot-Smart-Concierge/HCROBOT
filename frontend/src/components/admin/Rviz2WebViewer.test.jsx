import { describe, it, expect } from 'vitest';
import { buildRvizVncUrl } from './Rviz2WebViewer';

describe('Rviz2WebViewer URL & Config Helper', () => {
  it('should generate default noVNC connection URL correctly', () => {
    const url = buildRvizVncUrl();
    expect(url).toBe('http://127.0.0.1:6080/vnc.html?autoconnect=true&resize=scale&reconnect=true');
  });

  it('should accept custom host and port for remote robots', () => {
    const url = buildRvizVncUrl('100.99.72.51', 6081);
    expect(url).toContain('http://100.99.72.51:6081/vnc.html');
    expect(url).toContain('autoconnect=true');
  });

  it('should support custom resize and reconnect options', () => {
    const url = buildRvizVncUrl('localhost', 6080, {
      autoconnect: false,
      resize: 'off',
      reconnect: false,
    });
    expect(url).toBe('http://localhost:6080/vnc.html?autoconnect=false&resize=off&reconnect=false');
  });
});
