/* TT Fence Builder: poses on top of Kit.people.pose. Exposes FB.pose(p, phase, mode, k, opts).
   Extra modes: 'stand', 'hammer' (tapping fence posts in with his toy mallet; walks too when opts.moving),
   'oops' (hands on his head: the fence snapped, or a bug sneezed on him), 'cheer' (both fists up), 'point' (one arm
   out: the brother's freeze). Standing signature moves ('peace', 'wave', 'give') keep their legs still. */
(function () {
  'use strict';
  const FB = (window.FB = window.FB || {});
  const People = Kit.people;
  const STILL_LEGS = { peace: 1, wave: 1, give: 1 };
  const ease = (o, prop, v, k) => { o[prop] += (v - o[prop]) * k; };

  FB.pose = function (p, ph, mode, k, opts = {}) {
    if (mode === 'hammer') {
      People.pose(p, ph, opts.moving ? 'walk' : 'idle', k);
      const tap = Math.max(0, Math.sin(ph * (opts.moving ? 1 : 1.6)));
      p.armR.rotation.x = 1.2 + tap * 1.3;
      p.armR.rotation.z = 0.15;
      ease(p.armL.rotation, 'x', 0.5, k);
      ease(p.head.rotation, 'x', 0.2, k);
      return;
    }
    if (mode === 'oops') {
      People.pose(p, ph, 'idle', k);
      ease(p.armL.rotation, 'x', 2.7, k);
      ease(p.armR.rotation, 'x', 2.7, k);
      ease(p.armL.rotation, 'z', -0.85, k);
      ease(p.armR.rotation, 'z', 0.85, k);
      ease(p.head.rotation, 'x', 0.3, k);
      ease(p.hips.rotation, 'x', -0.1, k);
      return;
    }
    if (mode === 'cheer') {
      People.pose(p, ph, 'jump', k);
      ease(p.armL.rotation, 'x', 2.9, k);
      ease(p.armR.rotation, 'x', 2.9, k);
      ease(p.armL.rotation, 'z', -0.35, k);
      ease(p.armR.rotation, 'z', 0.35, k);
      ease(p.legL.rotation, 'x', 0, k);
      ease(p.legR.rotation, 'x', 0, k);
      return;
    }
    if (mode === 'point') {
      People.pose(p, ph, 'idle', k);
      ease(p.armR.rotation, 'x', 1.6, k);
      ease(p.armR.rotation, 'z', 0, k);
      ease(p.armL.rotation, 'x', 0.2, k);
      return;
    }
    if (mode === 'stand') {
      People.pose(p, ph, 'idle', k);
      ease(p.armL.rotation, 'z', -0.1, k);
      ease(p.armR.rotation, 'z', 0.1, k);
      return;
    }
    People.pose(p, ph, mode, k);
    if (STILL_LEGS[mode] && !opts.moving) {
      p.legL.rotation.x *= 0.25;
      p.legR.rotation.x *= 0.25;
      p.hips.position.y = p.hipY + Math.abs(Math.sin(ph)) * 0.03;
    }
  };
})();
