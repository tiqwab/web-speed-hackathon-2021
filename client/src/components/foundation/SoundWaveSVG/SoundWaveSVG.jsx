import React from 'react';

import { useFetch } from '../../../hooks/use_fetch';
import { fetchJSON } from '../../../utils/fetchers';

/**
 * @typedef {object} Props
 * @property {ArrayBuffer} soundData
 */

/**
 * @type {React.VFC<Props>}
 */
const SoundWaveSVG = ({ soundId }) => {
  const uniqueIdRef = React.useRef(Math.random().toString(16));

  const { data, isLoading } = useFetch(`/api/v1/sounds/${soundId}/wave`, fetchJSON);

  if (isLoading || data == null) {
      return null;
  }

  const { max, peaks } = data;

  return (
    <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 1">
      {peaks.map((peak, idx) => {
        const ratio = peak / max;
        return (
          <rect key={`${uniqueIdRef.current}#${idx}`} fill="#2563EB" height={ratio} width="1" x={idx} y={1 - ratio} />
        );
      })}
    </svg>
  );
};

export { SoundWaveSVG };
