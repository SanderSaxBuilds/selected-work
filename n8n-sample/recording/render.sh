#!/usr/bin/env bash
# frames.json + voice.mp3 -> final mp4, x264 CRF 18, 1080p, 30 fps.
B="$(cd "$(dirname "$0")/.." && pwd)"
cd "$B/recording" || exit 1
node -e "
const fs=require('fs');
const {frames,end}=JSON.parse(fs.readFileSync('frames.json','utf8'));
let out='ffconcat version 1.0\n';
frames.forEach((f,i)=>{const next=i+1<frames.length?frames[i+1].t:end;out+='file frames/'+f.name+'\nduration '+Math.max(0.001,next-f.t).toFixed(4)+'\n';});
out+='file frames/'+frames[frames.length-1].name+'\n';
fs.writeFileSync('frames.ffconcat',out);
const lead=frames[0].t; console.log('first frame at',lead.toFixed(2),'end',end.toFixed(2));
"
ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i frames.ffconcat -i ../voice.mp3 \
  -filter_complex "[0:v]fps=30,scale=1920:1080:flags=lanczos,format=yuv420p[v];[1:a]adelay=600:all=1,apad,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map "[v]" -map "[a]" -t 131.6 -c:v libx264 -preset slow -crf 18 -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart ../n8n-lead-intake-walkthrough.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate -of compact=p=0 ../n8n-lead-intake-walkthrough.mp4
