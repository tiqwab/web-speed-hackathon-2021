import { promises as fs } from 'fs';
import path from 'path';

import Router from 'express-promise-router';
import httpErrors from 'http-errors';
import { v4 as uuidv4 } from 'uuid';
import { AudioContext } from 'web-audio-api';

import { convertSound } from '../../converters/convert_sound';
import { PUBLIC_PATH, UPLOAD_PATH } from '../../paths';
import { extractMetadataFromSound } from '../../utils/extract_metadata_from_sound';

// 変換した音声の拡張子
const EXTENSION = 'mp3';

const router = Router();

router.post('/sounds', async (req, res) => {
  if (req.session.userId === undefined) {
    throw new httpErrors.Unauthorized();
  }
  if (Buffer.isBuffer(req.body) === false) {
    throw new httpErrors.BadRequest();
  }

  const soundId = uuidv4();

  const { artist, title } = await extractMetadataFromSound(req.body);

  const converted = await convertSound(req.body, {
    // 音声の拡張子を指定する
    extension: EXTENSION,
  });

  const filePath = path.resolve(UPLOAD_PATH, `./sounds/${soundId}.${EXTENSION}`);
  await fs.writeFile(filePath, converted);

  return res.status(200).type('application/json').send({ artist, id: soundId, title });
});

/**
 * @param {ArrayBuffer} data
 * @returns {Promise<{ max: number, peaks: number[] }}
 */
async function calculateWave(data) {
  const audioCtx = new AudioContext();

  // 音声をデコードする
  /** @type {AudioBuffer} */
  const buffer = await new Promise((resolve, reject) => {
    audioCtx.decodeAudioData(data.slice(0), resolve, reject);
  });

  // 左の音声データの絶対値を取る
  const leftData = buffer.getChannelData(0).map(Math.abs);
  // 右の音声データの絶対値を取る
  const rightData = buffer.getChannelData(1).map(Math.abs);

  // 左右の音声データの平均を取る
  let normalized = [];
  for (let i = 0; i < leftData.length; i++) {
    let v = (leftData[i] + rightData[i]) / 2;
    normalized.push(v);
  }

  // 100 個の chunk に分ける
  // それの平均値を取る
  const chunkSize = Math.ceil(normalized.length / 100);
  let peaks = [];
  let acc = 0;
  let prev_i = 0;
  for (let i = 0; i < normalized.length; i++) {
    acc += normalized[i];
    if ((i + 1) % chunkSize == 0 || (i + 1) == normalized.length) {
      const n = (i + 1) - prev_i;
      peaks.push(acc / n);
      prev_i = i;
      acc = 0;
    }
  }

  // 最大値の計算
  const max = peaks.reduce((cand, cur) => Math.max(cand, cur));

  return { max, peaks };
}

async function pathExists(path) {
  try {
    return !!(await fs.lstat(path));
  } catch (e) {
    return false;
  }
}

router.get('/sounds/:soundId/wave', async (req, res) => {
  // if (req.session.userId === undefined) {
  //   throw new httpErrors.Unauthorized();
  // }

  const soundId = req.params.soundId;

  let filePath = path.resolve(UPLOAD_PATH, `./sounds/${soundId}.${EXTENSION}`);
  if (!await pathExists(filePath)) {
    filePath = path.resolve(PUBLIC_PATH, `./sounds/${soundId}.${EXTENSION}`);
  }
  if (!await pathExists(filePath)) {
    return res.status(404).send();
  }

  const data = await fs.readFile(filePath);
  const { max, peaks } = await calculateWave(data);

  return res.status(200).type('application/json').send({
    max,
    peaks,
  });
});

export { router as soundRouter };
