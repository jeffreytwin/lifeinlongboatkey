#!/usr/bin/env node
// Apply user-provided condo coordinates. Lat/lng replace centerline
// placements; location (north/mid/south) is re-derived from lat so
// filter results match what the user sees on the map.
//
// Zone thresholds are midpoints between the three user-supplied anchors:
//   north anchor 27.42696  -> N/M boundary 27.40586
//   mid anchor   27.38476
//   south anchor 27.33751  -> M/S boundary 27.36114

import { readFileSync, writeFileSync } from 'node:fs';

const IN = 'src/data/communities.json';
const data = JSON.parse(readFileSync(IN, 'utf8'));

const N_M = 27.40586;
const M_S = 27.36114;
function zoneOf(lat) {
  if (lat >= N_M) return 'north';
  if (lat >= M_S) return 'mid';
  return 'south';
}

// User-provided table (copied verbatim from the spreadsheet paste).
const PLACED = {
  'Aquarius Club':                         [27.35285096575884, -82.61303834544344],
  'Arbomar':                               [27.394809276580254, -82.64577412605013],
  'Aria':                                  [27.36077211930464, -82.62074554527761],
  'Banyan Bay Club':                       [27.40941965538911, -82.65489283293395],
  'Bay Harbour':                           [27.339762742942717, -82.59149954600679],
  'Bayport Beach & Tennis':                [27.385038384632516, -82.63658614485465],
  'Beach Castle':                          [27.409985781545025, -82.65538580206204],
  'Beach Harbor Club':                     [27.38263053329866, -82.63724201782004],
  'Beachcomber':                           [27.36640840658389, -82.62612748767191],
  'Beachplace':                            [27.34663681587277, -82.60692375832521],
  'Buttonwood Cove':                       [27.3799952130316, -82.6348777605876],
  'Cabana Beach Club':                     [27.41797001179524, -82.66563654833473],
  'Casa Del Mar':                          [27.397392605446846, -82.6479390939713],
  'Castillian':                            [27.395894645944573, -82.64658973901993],
  'Cedars West':                           [27.415242745870138, -82.66283406644337],
  'Cedars East':                           [27.4160735407108, -82.66176433778917],
  'Club Longboat':                         [27.405207457787903, -82.65291997868844],
  'En Provence':                           [27.359222121800006, -82.61904182309078],
  'Fairway Bay (Bay Isles)':               [27.359595805193173, -82.61263717413219],
  'Grand Bay (Bay Isles)':                 [27.37762015815347, -82.61725689309559],
  'Grand Mariner':                         [27.423966548212597, -82.66817358233591],
  'Harbour Villa Club':                    [27.424218911648477, -82.66711142768285],
  'Infinity':                              [27.400600942946763, -82.65008472312552],
  'Inn on the Beach (Longboat Key Club)':  [27.331389545802118, -82.59193942160547],
  'Islander Club':                         [27.36110951264581, -82.6219997977344],
  'Islands West':                          [27.364373695065893, -82.62441966940445],
  "L'Ambiance (Longboat Key Club)":        [27.33271725066466, -82.59307690693666],
  'La Firenza':                            [27.388992560734906, -82.64155273714616],
  'La Playa':                              [27.394159521508943, -82.6452254676403],
  'Longboat Arms':                         [27.375964193493292, -82.63167476265619],
  'Longboat Beach House':                  [27.391696103418095, -82.64339588181818],
  'Longboat Harbour':                      [27.396691864224483, -82.64519444377837],
  'Longboat Harbour Towers':               [27.393289980211613, -82.64477757618737],
  'Longboat Key Club':                     [27.330658235561664, -82.5910490084704],
  'Longboat Key Towers (Longboat Key Club)': [27.337651696588296, -82.59829198094283],
  'Longboat Landing':                      [27.410422979523098, -82.65514479737053],
  'Longboat Terrace':                      [27.410266227081692, -82.65775695302648],
  'Marina Bay (Bay Isles)':                [27.366701057931447, -82.61750509308727],
  'Neptune':                               [27.368306898563713, -82.62689737727705],
  'Northgate':                             [27.439478272701873, -82.686606717193],
  'Pelican Harbour & Beach Club':          [27.39107160191011, -82.64122697114844],
  'Pierre (Longboat Key Club)':            [27.334248729348474, -82.59425759383957],
  'Players Club':                          [27.350360323679833, -82.6100495630143],
  'Portobello':                            [27.37409357194587, -82.63199441453041],
  'Positano':                              [27.40310491619186, -82.6517818479397],
  'Privateer (Longboat Key Club)':         [27.343488897956316, -82.60392313381618],
  'Promenade':                             [27.347998927060267, -82.6075567126849],
  'Regent Place (Longboat Key Club)':      [27.33890064180566, -82.59906706750171],
  'Sage Longboat Key':                     [27.398416080594135, -82.64832865027647],
  'Sand Cay Beach Resort':                 [27.400049021307566, -82.64932373533607],
  'Sands Point':                           [27.32997947068731, -82.58905538203598],
  'Sea Gate Club':                         [27.36316856174072, -82.62348068755193],
  'Sea Grape Inn':                         [27.406385820317983, -82.65426675127817],
  'Sea Oats':                              [27.41342003320849, -82.66118269196164],
  'Sea Pines':                             [27.434237034089247, -82.68586664927876],
  'Seahorse Beach Resort':                 [27.376870207834887, -82.6341053202358],
  'Seaplace':                              [27.356257141414826, -82.61620919543256],
  'Seascape':                              [27.40668095265045, -82.65432960486332],
  'Silver Sands':                          [27.417760795811166, -82.66543489687804],
  'Sunset Beach':                          [27.35807548551353, -82.617675125702],
  'Sutton Place':                          [27.394122644984495, -82.64241563838827],
  'Tangerine Bay Club':                    [27.33846183335708, -82.58852107435231],
  'The Beach on Longboat Key':             [27.377539203008382, -82.63457204521187],
  'The Beaches (Longboat Key Club)':       [27.340105138156996, -82.60012402144444],
  'The Grande at Longboat Key':            [27.396886716521166, -82.64712433625562],
  'The Residences at The St. Regis':       [27.35194096881402, -82.61191794781026],
  'The Sanctuary (Longboat Key Club)':     [27.33504738492107, -82.59504662252944],
  'The Shore':                             [27.416479248986306, -82.66375568997768],
  'Tiffany Plaza':                         [27.392409477871205, -82.64382929381951],
  'Turtle Crawl Inn':                      [27.390621677716016, -82.6426695817696],
  'Veinte':                                [27.366039360453215, -82.62554871676132],
  'Villa di Lancia':                       [27.360130445923772, -82.619840827192],
  'Vizcaya':                               [27.362489536849154, -82.6222895408897],
  'Water Club':                            [27.34905581335028, -82.60864226582467],
  'Westchester':                           [27.401618130857216, -82.6506781549049],
  'Whitney Beach':                         [27.431340523213258, -82.6813286539529],
  'Windward Bay':                          [27.403347256472046, -82.64982304009251],
};

// Condos not in the user table but placed by proximity to a known sibling.
// Currently empty — all 77 condos have direct coordinates.
const SIBLINGS = {};

const rezonedList = [];
let placedCount = 0, siblingCount = 0, leftoverCount = 0;
const leftovers = [];

for (const c of data) {
  if (c.type !== 'condo') continue;

  const direct = PLACED[c.name];
  if (direct) {
    const [lat, lng] = direct;
    const prevZone = c.location;
    const newZone = zoneOf(lat);
    c.lat = +lat.toFixed(6);
    c.lng = +lng.toFixed(6);
    c.coordSource = 'placed';
    if (prevZone !== newZone) {
      rezonedList.push({ name: c.name, from: prevZone, to: newZone, lat });
      c.location = newZone;
    }
    placedCount++;
    continue;
  }

  const sib = SIBLINGS[c.name];
  if (sib) {
    const anchor = PLACED[sib.near];
    if (anchor) {
      const lat = anchor[0] + sib.dLat;
      const lng = anchor[1] + sib.dLng;
      c.lat = +lat.toFixed(6);
      c.lng = +lng.toFixed(6);
      c.coordSource = 'clustered';
      const newZone = zoneOf(lat);
      if (c.location !== newZone) {
        rezonedList.push({ name: c.name, from: c.location, to: newZone, lat });
        c.location = newZone;
      }
      siblingCount++;
      continue;
    }
  }

  c.coordSource = c.coordSource || 'centerline';
  leftovers.push(c.name);
  leftoverCount++;
}

writeFileSync(IN, JSON.stringify(data) + '\n');

console.log(`Placed from table     : ${placedCount}`);
console.log(`Placed near sibling   : ${siblingCount}`);
console.log(`Condos still on line  : ${leftoverCount}`);
if (leftovers.length) {
  console.log('  -', leftovers.join(', '));
}

if (rezonedList.length) {
  console.log(`\nRe-zoned by coordinate (${rezonedList.length}):`);
  rezonedList.sort((a, b) => a.name.localeCompare(b.name))
    .forEach((r) => console.log(`  ${r.name.padEnd(36)}  ${r.from} -> ${r.to}  (lat ${r.lat.toFixed(4)})`));
}

// Final zone tallies
const finalTally = { north: 0, mid: 0, south: 0 };
for (const c of data) if (c.type === 'condo') finalTally[c.location]++;
console.log(`\nFinal condo zone tally: north=${finalTally.north}, mid=${finalTally.mid}, south=${finalTally.south}`);
