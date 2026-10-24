import { Detector, type AgentObservation, type DetectorConfig } from "../src/lib/detector";
import type { AgentRunSignal } from "../src/types";
// A complete DetectorConfig: an incomplete literal leaves completedSettleSec
// undefined and the settle comparison NaN, so the completed scenario can never fire.
const cfg:DetectorConfig={loopTurnDelta:3,completedSettleSec:60,completedCooldownSec:300};
const d=new Detector(cfg,1000,"demo-task");
function observation(messages:string[],streaming:boolean,now:number):AgentObservation{return {isStreaming:streaming,hasTerminalArtifact:messages.length>0,turnCount:messages.length,assistantMessages:messages,lastMessageText:messages.at(-1)||"",lastActivityAt:now,now};}
// The recorded output in docs/demo-results.json is what this script prints, so a
// detector change that invalidates a scenario must fail here loudly instead of
// leaving a stale demo on the README and the website.
function emit(scenario:string,signals:AgentRunSignal[]):void{
 if(signals.length===0){throw new Error(`${scenario}: the fixture produced no signal — it no longer matches the Detector`);}
 console.log(JSON.stringify(signals,null,2));
}
const scenario=process.argv[2]||"completed";
if(scenario==="completed"){
 d.observe(observation(["Working on the local example."],true,1000));
 // streaming stops — this starts the settle window the Detector now requires
 d.observe(observation(["The example is complete."],false,2000));
 // one observation 60s later: the DOM stayed quiet, so the run is complete
 emit("completed",d.observe(observation(["The example is complete."],false,62000)));
}else if(scenario==="loop"){
 const repeated="This local fixture message is deliberately longer than sixty characters and repeats.";
 d.observe(observation([repeated],true,1000));
 emit("loop",d.observe(observation([repeated,"A different intermediate message.",repeated],true,61000)));
}else{throw new Error("Expected completed or loop");}
