import { Detector, type AgentObservation } from "../src/lib/detector";
const cfg={loopTurnDelta:3,loopThresholdMin:5};
const d=new Detector(cfg,1000,"demo-task");
function observation(messages:string[],streaming:boolean,now:number):AgentObservation{return {isStreaming:streaming,hasTerminalArtifact:messages.length>0,turnCount:messages.length,assistantMessages:messages,lastMessageText:messages.at(-1)||"",lastActivityAt:now,now};}
const scenario=process.argv[2]||"completed";
if(scenario==="completed"){
 d.observe(observation(["Working on the local example."],true,1000));
 console.log(JSON.stringify(d.observe(observation(["The example is complete."],false,61000)),null,2));
}else if(scenario==="loop"){
 const repeated="This local fixture message is deliberately longer than sixty characters and repeats.";
 d.observe(observation([repeated],true,1000));
 console.log(JSON.stringify(d.observe(observation([repeated,"A different intermediate message.",repeated],true,61000)),null,2));
}else{throw new Error("Expected completed or loop");}
