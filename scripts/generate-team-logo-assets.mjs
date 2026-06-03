import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.join(process.cwd(), "public/images/team-logos");

const font = "Arial Black, Impact, system-ui, sans-serif";
const serif = "Georgia, Times New Roman, serif";

function svgShell(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${body}</svg>`;
}

const logos = [
  {
    file: "hangang-united",
    svg: svgShell(`
      <defs>
        <radialGradient id="bg" cx="50%" cy="46%" r="58%"><stop stop-color="#183D67"/><stop offset="1" stop-color="#071726"/></radialGradient>
        <linearGradient id="gold" x1="120" x2="904" y1="108" y2="916" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF1C5"/><stop offset=".32" stop-color="#B9873C"/><stop offset=".62" stop-color="#FFE9AB"/><stop offset="1" stop-color="#765018"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#00101F" flood-opacity=".62"/></filter>
      </defs>
      <g filter="url(#s)">
        <circle cx="512" cy="512" r="405" fill="url(#gold)"/>
        <circle cx="512" cy="512" r="368" fill="url(#bg)" stroke="#F8DFA3" stroke-width="12"/>
        <circle cx="512" cy="512" r="228" fill="none" stroke="#F8DFA3" stroke-width="10"/>
        <circle cx="512" cy="512" r="168" fill="none" stroke="#F8DFA3" stroke-width="4" opacity=".45"/>
        <path fill="#F8DFA3" d="M512 242 552 472l229 40-229 40-40 230-40-230-229-40 229-40 40-230Z"/>
        <path fill="#071726" d="m512 336 22 135 136 25-136 25-22 136-22-136-136-25 136-25 22-135Z"/>
        <circle cx="512" cy="512" r="26" fill="#F8DFA3"/>
        <path fill="none" stroke="#F8DFA3" stroke-linecap="round" stroke-width="18" d="M240 642c76-33 142-31 206 4 77 43 161 39 340-12"/>
        <path fill="none" stroke="#6CE6FF" stroke-linecap="round" stroke-width="13" d="M264 694c69-25 130-21 190 9 76 38 157 30 306-14"/>
        <text x="512" y="205" text-anchor="middle" font-family="${serif}" font-size="82" font-weight="900" fill="#F8DFA3" letter-spacing="18">NOVA FC</text>
        <text x="512" y="845" text-anchor="middle" font-family="${font}" font-size="46" fill="#F8DFA3" letter-spacing="8">FUTSAL CLUB</text>
        <text x="204" y="536" font-family="${font}" font-size="42" fill="#F8DFA3">20</text>
        <text x="758" y="536" font-family="${font}" font-size="42" fill="#F8DFA3">20</text>
      </g>`)
  },
  {
    file: "mapo-rangers",
    svg: svgShell(`
      <defs>
        <linearGradient id="red" x1="142" x2="882" y1="104" y2="914" gradientUnits="userSpaceOnUse"><stop stop-color="#FF2323"/><stop offset=".55" stop-color="#8B0610"/><stop offset="1" stop-color="#1A0104"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#000" flood-opacity=".7"/></filter>
      </defs>
      <g filter="url(#s)">
        <path fill="#F2F2F2" d="M512 54 884 180 726 768 512 952 298 768 140 180 512 54Z"/>
        <path fill="#090909" d="M512 102 820 207 686 742 512 892 338 742 204 207 512 102Z"/>
        <path fill="url(#red)" d="M252 252h520L652 712 512 834 372 712 252 252Z"/>
        <path fill="#0A0A0A" d="M294 302h436l-30 113H324l-30-113Z"/>
        <text x="512" y="249" text-anchor="middle" font-family="${font}" font-size="126" fill="#FFFFFF" letter-spacing="8">RIFT</text>
        <text x="512" y="344" text-anchor="middle" font-family="${font}" font-size="64" fill="#FF2323" letter-spacing="9">FC</text>
        <path fill="#FFFFFF" d="M224 558c217-153 368-225 511-270-55 121-154 231-307 323l-74 99-18-105-112-47Z"/>
        <path fill="#E91522" d="M316 504c109-78 220-130 352-157-88 75-170 139-299 203l-53-46Z"/>
        <path fill="#090909" d="M368 650c92-102 189-182 304-244-80 126-177 214-275 264l-29-20Z"/>
        <circle cx="403" cy="778" r="62" fill="#F7F7F7"/>
        <circle cx="403" cy="778" r="47" fill="#080808"/>
        <path fill="#FFFFFF" d="m403 721 35 26-14 42h-42l-14-42 35-26Z"/>
      </g>`)
  },
  {
    file: "seongsu-fs",
    svg: svgShell(`
      <defs>
        <linearGradient id="teal" x1="130" x2="894" y1="80" y2="920" gradientUnits="userSpaceOnUse"><stop stop-color="#02E8C2"/><stop offset=".43" stop-color="#006B5E"/><stop offset="1" stop-color="#071312"/></linearGradient>
        <linearGradient id="steel" x1="140" x2="884" y1="94" y2="910" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset=".24" stop-color="#7E898E"/><stop offset=".52" stop-color="#F8FFFF"/><stop offset="1" stop-color="#1B2428"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#001915" flood-opacity=".72"/></filter>
      </defs>
      <g filter="url(#s)">
        <path fill="#050B0A" d="M512 60 842 208v454L512 938 182 662V208L512 60Z"/>
        <path fill="url(#steel)" d="M512 103 792 231v408L512 880 232 639V231L512 103Z"/>
        <path fill="url(#teal)" d="M512 148 739 254v360L512 823 285 614V254l227-106Z"/>
        <path fill="#07110F" d="M318 314h388l-78 282H396l-78-282Z"/>
        <path fill="#F8FFFF" d="M513 176 567 373h157l-132 77 49 194-128-120-128 120 49-194-132-77h157l54-197Z"/>
        <path fill="#00D5B0" d="M512 248 542 378h108l-91 52 34 127-81-82-81 82 34-127-91-52h108l30-130Z"/>
        <circle cx="512" cy="542" r="94" fill="#F7FBFF" stroke="#081210" stroke-width="16"/>
        <path fill="#081210" d="m512 448 60 44-23 71h-74l-23-71 60-44Z"/>
        <path fill="none" stroke="#00D5B0" stroke-width="10" d="M512 448v188M424 512h176M456 592l112-103"/>
        <text x="512" y="746" text-anchor="middle" font-family="${font}" font-size="92" fill="#F7FBFF" letter-spacing="10">VOLT FC</text>
        <text x="512" y="827" text-anchor="middle" font-family="${font}" font-size="40" fill="#00D5B0" letter-spacing="10">FUTSAL CLUB</text>
      </g>`)
  },
  {
    file: "euljiro-palace",
    svg: svgShell(`
      <defs>
        <linearGradient id="gold" x1="164" x2="860" y1="80" y2="916" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE392"/><stop offset=".34" stop-color="#B47D21"/><stop offset=".62" stop-color="#FFF0AF"/><stop offset="1" stop-color="#7B4B0B"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#000" flood-opacity=".7"/></filter>
      </defs>
      <g filter="url(#s)">
        <path fill="url(#gold)" d="M512 68 786 194v650L512 966 238 844V194L512 68Z"/>
        <path fill="#0F0E0B" d="M512 133 716 227v572L512 893 308 799V227L512 133Z"/>
        <path fill="url(#gold)" d="M512 177 556 265h95l-76 57 28 94-91-55-91 55 28-94-76-57h95l44-88Z"/>
        <path fill="none" stroke="url(#gold)" stroke-linejoin="round" stroke-width="44" d="M332 766V382l98-76v330l82-60 82 60V306l98 76v384"/>
        <path fill="#0F0E0B" d="M400 415h60v244h-60zm164 0h60v244h-60z"/>
        <path fill="none" stroke="url(#gold)" stroke-width="34" d="M306 770h412M354 836h316"/>
        <text x="512" y="555" text-anchor="middle" font-family="${font}" font-size="150" fill="#FFE392" letter-spacing="10">AFC</text>
      </g>`)
  },
  {
    file: "gangnam-spark",
    svg: svgShell(`
      <defs>
        <linearGradient id="orange" x1="90" x2="934" y1="92" y2="928" gradientUnits="userSpaceOnUse"><stop stop-color="#FF8A00"/><stop offset=".55" stop-color="#913B00"/><stop offset="1" stop-color="#120703"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#000" flood-opacity=".72"/></filter>
      </defs>
      <g filter="url(#s)">
        <circle cx="512" cy="512" r="398" fill="url(#orange)"/>
        <circle cx="512" cy="512" r="344" fill="#111" stroke="#FFB45E" stroke-width="18"/>
        <circle cx="512" cy="512" r="256" fill="#252525" stroke="#5B2600" stroke-width="28"/>
        <text x="512" y="205" text-anchor="middle" font-family="${font}" font-size="84" fill="#FFE5BF" letter-spacing="12">BULLS FC</text>
        <path fill="#FF8A00" d="M268 548c40-198 448-198 488 0-78-81-159-72-208 15-48 84-206 96-280-15Z"/>
        <path fill="#111" d="M366 500c43-38 95-57 146-57s103 19 146 57c-72-12-111 11-146 48-35-37-74-60-146-48Z"/>
        <path fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-width="48" d="M272 398c-78-50-116-117-116-117l145 50M752 398c78-50 116-117 116-117l-145 50"/>
        <path fill="#FF8A00" d="m512 245 57 166h174L602 510l54 171-144-106-144 106 54-171-141-99h174l57-166Z"/>
        <path fill="#101010" d="m512 337 31 89h94l-76 53 29 92-78-57-78 57 29-92-76-53h94l31-89Z"/>
        <circle cx="512" cy="694" r="44" fill="#FFE5BF"/>
        <text x="512" y="870" text-anchor="middle" font-family="${font}" font-size="52" fill="#FFE5BF" letter-spacing="8">FUTSAL CLUB</text>
      </g>`)
  },
  {
    file: "bluewave-fc",
    svg: svgShell(`
      <defs>
        <linearGradient id="blue" x1="188" x2="830" y1="72" y2="914" gradientUnits="userSpaceOnUse"><stop stop-color="#2B6DA7"/><stop offset=".44" stop-color="#07355F"/><stop offset="1" stop-color="#031326"/></linearGradient>
        <linearGradient id="wave" x1="278" x2="730" y1="610" y2="806" gradientUnits="userSpaceOnUse"><stop stop-color="#A6F0FF"/><stop offset=".42" stop-color="#128BD8"/><stop offset="1" stop-color="#003B8F"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#001428" flood-opacity=".68"/></filter>
      </defs>
      <g filter="url(#s)">
        <path fill="#F7FBFF" d="M512 70h300v602L512 944 212 672V70h300Z"/>
        <path fill="url(#blue)" d="M512 112h248v536L512 882 264 648V112h248Z"/>
        <path fill="#061F3A" d="M308 182h408v304H308z"/>
        <text x="512" y="288" text-anchor="middle" font-family="${font}" font-size="122" fill="#F7FBFF" letter-spacing="8">BLUE 7</text>
        <text x="512" y="374" text-anchor="middle" font-family="${font}" font-size="62" fill="#C9EFFF" letter-spacing="13">FUTSAL CLUB</text>
        <path fill="#F7FBFF" d="M290 590 450 424l65 82 54-52 175 184H290Z"/>
        <path fill="#0A345C" d="m450 424 64 82-38 37-38-57-90 104H290l160-166Zm119 30 124 130-64-24-80-70 20-36Z"/>
        <path fill="url(#wave)" d="M294 690c98-110 178-133 260-82 52 33 107 27 171-19-31 104-105 171-211 199-68 17-146-8-220-98Z"/>
        <path fill="#F7FBFF" d="M336 702c72-57 129-64 174-21 33 32 73 36 120 12-37 53-88 77-154 73-56-4-103-25-140-64Z"/>
        <text x="310" y="848" font-family="${font}" font-size="42" fill="#F7FBFF">20</text>
        <text x="662" y="848" font-family="${font}" font-size="42" fill="#F7FBFF">20</text>
      </g>`)
  },
  {
    file: "gwanak-dreamers",
    svg: svgShell(`
      <defs>
        <linearGradient id="violet" x1="118" x2="906" y1="108" y2="918" gradientUnits="userSpaceOnUse"><stop stop-color="#8D4CFF"/><stop offset=".48" stop-color="#21114B"/><stop offset="1" stop-color="#050914"/></linearGradient>
        <linearGradient id="bird" x1="300" x2="750" y1="286" y2="652" gradientUnits="userSpaceOnUse"><stop stop-color="#66F2FF"/><stop offset=".45" stop-color="#8A4DFF"/><stop offset="1" stop-color="#2B0B56"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#000" flood-opacity=".7"/></filter>
      </defs>
      <g filter="url(#s)">
        <path fill="url(#violet)" d="M158 206 382 294 512 126l130 168 224-88-84 280 120 146H724L512 918 300 632H122l120-146-84-280Z"/>
        <path fill="#0B1020" d="M224 282 410 354l102-132 102 132 186-72-66 214 78 94H682L512 817 342 590H212l78-94-66-214Z"/>
        <path fill="url(#bird)" d="M302 516c155-236 310-276 462-122-148-23-250 48-310 196-33-69-82-92-152-74Z"/>
        <path fill="#A855F7" d="M438 318c80-60 175-86 285-81l-86 75 111 16-176 60 76 43-202 45 82-78-118-18 28-62Z"/>
        <path fill="#F7FBFF" d="M694 340 719 413l75 1-61 44 24 74-63-46-63 46 24-74-61-44 75-1 25-73Z"/>
        <path fill="#5DEBFF" d="M246 394 332 348 284 486Z"/>
        <path fill="none" stroke="#5DEBFF" stroke-width="24" d="M250 636h524"/>
        <text x="512" y="746" text-anchor="middle" font-family="${font}" font-size="104" fill="#F7FBFF" letter-spacing="11">ORION</text>
        <text x="512" y="828" text-anchor="middle" font-family="${font}" font-size="58" fill="#5DEBFF" letter-spacing="11">FC</text>
      </g>`)
  },
  {
    file: "nowon-tigers",
    svg: svgShell(`
      <defs>
        <linearGradient id="orange" x1="96" x2="914" y1="106" y2="928" gradientUnits="userSpaceOnUse"><stop stop-color="#FF9A1F"/><stop offset=".55" stop-color="#A44904"/><stop offset="1" stop-color="#120703"/></linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="28" flood-color="#000" flood-opacity=".72"/></filter>
      </defs>
      <g filter="url(#s)">
        <circle cx="512" cy="512" r="400" fill="url(#orange)"/>
        <circle cx="512" cy="512" r="348" fill="#101010" stroke="#FFB35B" stroke-width="16"/>
        <circle cx="512" cy="512" r="265" fill="#24160E" stroke="#612B05" stroke-width="26"/>
        <text x="512" y="215" text-anchor="middle" font-family="${font}" font-size="86" fill="#FFE5BE" letter-spacing="12">NOWON</text>
        <path fill="#FF8A00" d="M270 572c62-150 420-150 484 0-76-46-128-47-190-1-37 28-68 42-100 42-58 0-109-29-194-41Z"/>
        <path fill="#0E0E0E" d="M344 478c48-46 106-68 168-68s120 22 168 68c-68-12-116 4-168 47-52-43-100-59-168-47Z"/>
        <path fill="#FFE5BE" d="M209 424c50-63 95-98 160-117l-28 75 86-35-61 83 55-11-95 70-117-65Zm606 0c-50-63-95-98-160-117l28 75-86-35 61 83-55-11 95 70 117-65Z"/>
        <path fill="#0E0E0E" d="M456 552c34 20 78 20 112 0-23 62-89 62-112 0Z"/>
        <circle cx="512" cy="704" r="48" fill="#FFE5BE"/>
        <circle cx="512" cy="704" r="34" fill="#111"/>
        <path fill="#FFE5BE" d="m512 659 29 21-11 35h-36l-11-35 29-21Z"/>
        <text x="512" y="850" text-anchor="middle" font-family="${font}" font-size="76" fill="#FFE5BE" letter-spacing="12">TIGERS</text>
      </g>`)
  },
];

await fs.mkdir(outDir, { recursive: true });

for (const logo of logos) {
  const svgPath = path.join(outDir, `${logo.file}.svg`);
  const pngPath = path.join(outDir, `${logo.file}.png`);
  await fs.writeFile(svgPath, logo.svg);
  await sharp(Buffer.from(logo.svg)).resize(1024, 1024).png().toFile(pngPath);
}

console.log(`Generated ${logos.length} team logo SVG/PNG assets in ${outDir}`);
