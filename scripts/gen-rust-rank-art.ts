#!/usr/bin/env bun

import { writeFileSync } from "fs";
import { join } from "path";
import {
  ART_WIDTH,
  CHAMPION_DIGIT_MASKS,
  CHAMPION_NUMBER_CELLS,
  RANK_ART_MAP,
  RANK_COLORS_MAP,
} from "../apps/web/src/rank-art-data";

const output = join(import.meta.dir, "../packages/renderer/src/rank-art-data.json");
const data = {
  width: ART_WIDTH,
  colors: RANK_COLORS_MAP,
  art: RANK_ART_MAP,
  championCells: CHAMPION_NUMBER_CELLS,
  championDigits: CHAMPION_DIGIT_MASKS,
};

writeFileSync(output, `${JSON.stringify(data)}\n`, "utf8");
