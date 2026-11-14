import type { PYQQuestion } from "../utils/pyq";
import paper2015gs11 from "./cse-2015-gs1-part-1-bank.json";
import paper2015gs12 from "./cse-2015-gs1-part-2-bank.json";
import paper2015csat1 from "./cse-2015-csat-part-1-bank.json";
import paper2015csat2 from "./cse-2015-csat-part-2-bank.json";
import paper2016gs11 from "./cse-2016-gs1-part-1-bank.json";
import paper2016gs12 from "./cse-2016-gs1-part-2-bank.json";
import paper2016csat1 from "./cse-2016-csat-part-1-bank.json";
import paper2016csat2 from "./cse-2016-csat-part-2-bank.json";
import paper2017gs11 from "./cse-2017-gs1-part-1-bank.json";
import paper2017gs12 from "./cse-2017-gs1-part-2-bank.json";
import paper2017csat1 from "./cse-2017-csat-part-1-bank.json";
import paper2017csat2 from "./cse-2017-csat-part-2-bank.json";
import paper2018gs11 from "./cse-2018-gs1-part-1-bank.json";
import paper2018gs12 from "./cse-2018-gs1-part-2-bank.json";
import paper2018csat1 from "./cse-2018-csat-part-1-bank.json";
import paper2018csat2 from "./cse-2018-csat-part-2-bank.json";

// Preserve full booklet order in small offline-capable data bundles.
const papers = [...paper2015gs11, ...paper2015gs12, ...paper2015csat1, ...paper2015csat2, ...paper2016gs11, ...paper2016gs12, ...paper2016csat1, ...paper2016csat2, ...paper2017gs11, ...paper2017gs12, ...paper2017csat1, ...paper2017csat2, ...paper2018gs11, ...paper2018gs12, ...paper2018csat1, ...paper2018csat2] as PYQQuestion[];
export default papers;
