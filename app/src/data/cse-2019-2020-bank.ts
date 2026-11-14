import type { PYQQuestion } from "../utils/pyq";
import paper2019gs11 from "./cse-2019-gs1-part-1-bank.json";
import paper2019gs12 from "./cse-2019-gs1-part-2-bank.json";
import paper2019csat1 from "./cse-2019-csat-bank.json";
import paper2020gs11 from "./cse-2020-gs1-part-1-bank.json";
import paper2020gs12 from "./cse-2020-gs1-part-2-bank.json";
import paper2020csat1 from "./cse-2020-csat-bank.json";

// Preserve complete booklet order while shipping each paper in smaller bundles.
const papers = [...paper2019gs11, ...paper2019gs12, ...paper2019csat1, ...paper2020gs11, ...paper2020gs12, ...paper2020csat1] as PYQQuestion[];
export default papers;
