#!/usr/bin/env python3
"""Apply hand-authored editorial metadata to episode 002 media_search.json."""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
MANIFEST = REPO / "episodes/002_DidBonScottKnowHeWasGoingToDie/timeline/media_search.json"

DEFAULT_AVOID = [
    "stock explainer",
    "corporate presentation",
    "literal album cover art",
    "AI generated faces",
    "modern stock photo",
]


def _hist(
    editorial_intent: str,
    situation: str,
    queries: list[str],
    *,
    people: list[dict[str, str]] | None = None,
    date_from: str = "",
    date_to: str = "",
    location: str = "",
    avoid: list[str] | None = None,
    priority: str = "high",
    media_type: str = "photo",
) -> dict[str, Any]:
    return {
        "visual_mode": "historical",
        "text_graphic": None,
        "artifact": None,
        "editorial_intent": editorial_intent,
        "people": people or [],
        "situation": situation,
        "date_from": date_from,
        "date_to": date_to,
        "location": location,
        "search_queries": queries,
        "avoid": avoid if avoid is not None else list(DEFAULT_AVOID),
        "media_type": media_type,
        "priority": priority,
    }


def _artifact(
    editorial_intent: str,
    object_name: str,
    story_link: str,
    queries: list[str],
    *,
    situation: str = "",
    date_from: str = "1975",
    date_to: str = "1985",
    avoid: list[str] | None = None,
    priority: str = "high",
    media_preference: str = "photo",
) -> dict[str, Any]:
    return {
        "visual_mode": "artifact",
        "text_graphic": None,
        "artifact": {
            "object": object_name,
            "story_link": story_link,
            "media_preference": media_preference,
        },
        "editorial_intent": editorial_intent,
        "people": [],
        "situation": situation or f"Inanimate: {object_name}",
        "date_from": date_from,
        "date_to": date_to,
        "location": "",
        "search_queries": queries,
        "avoid": (avoid if avoid is not None else list(DEFAULT_AVOID))
        + ["faces prominent", "glamorized drug use"],
        "media_type": media_preference,
        "priority": priority,
    }


def _text(
    editorial_intent: str,
    tg_type: str,
    text: str,
    style: str = "typewriter",
    *,
    priority: str = "high",
) -> dict[str, Any]:
    return {
        "visual_mode": "text_graphic",
        "text_graphic": {"type": tg_type, "text": text, "style": style},
        "artifact": None,
        "editorial_intent": editorial_intent,
        "people": [],
        "situation": f"Generated text graphic ({tg_type})",
        "date_from": "",
        "date_to": "",
        "location": "",
        "search_queries": [],
        "avoid": [],
        "media_type": "generated",
        "priority": priority,
    }


# Cue-level editorial (m001–m069). m000 / m070 unchanged except m070 intent fix.
EDITORIAL: dict[str, dict[str, Any]] = {
    "m001": _hist(
        "Cold-open thesis — Bon portrait or live close-up with weight; man who sensed the end coming. "
        "NOT courtroom, NOT crowd wide shot.",
        "Bon Scott close portrait or mid-performance 1979 — knowing, tired eyes",
        [
            "Bon Scott portrait 1979 photograph",
            "Bon Scott AC/DC live close up microphone 1979",
            "Bon Scott backstage 1979 candid",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1980",
        avoid=DEFAULT_AVOID + ["courtroom", "jury", "wide crowd only"],
    ),
    "m002": _hist(
        "Faustian bargain — fame traded for cost. Crossroads mood without literal devil costume.",
        "Robert Johnson crossroads folklore OR Bon at peak fame 1979 — calculated risk",
        [
            "crossroads Mississippi blues folklore photograph",
            "Bon Scott AC/DC fame 1979 press",
            "rock star spotlight silhouette 1970s",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m003": _hist(
        "'That's why he wrote Highway to Hell' — 1979 tour energy or studio session, era-accurate.",
        "AC/DC Highway to Hell era — Bon on stage or in studio 1979",
        [
            "Bon Scott Highway to Hell tour 1979 live",
            "AC/DC recording Highway to Hell 1979",
            "Bon Scott microphone 1979 performance",
        ],
        people=[
            {"name": "Bon Scott", "role": "vocalist"},
            {"name": "AC/DC", "role": "band"},
        ],
        date_from="1979",
        date_to="1979",
    ),
    "m004": _hist(
        "'Listen to Bon's voice' — tight on mic, mouth, cord — invitation to *hear*, not watch crowd.",
        "Bon Scott singing into microphone close-up 1979",
        [
            "Bon Scott singing microphone close up 1979",
            "Bon Scott vocal performance Highway to Hell",
            "AC/DC studio vocal booth 1979",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m005": _hist(
        "Early AC/DC — coiled, aggressive Bon before the shift. High Voltage / TNT era electricity.",
        "Early Bon Scott AC/DC — snarl, fight-ready, pre-1979 intensity",
        [
            "Bon Scott AC/DC early 1970s live aggressive",
            "Bon Scott High Voltage tour live photograph",
            "Bon Scott 1976 1977 stage snarl",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
        date_from="1975",
        date_to="1978",
    ),
    "m006": _text(
        "Punctuation beat — kinetic type on grain; 'coiled spring' metaphor, not another portrait.",
        "title",
        "COILED SPRING.",
        "blockbuster",
        priority="medium",
    ),
    "m007": _hist(
        "Fight-ready early Bon — about to jump into a brawl; kinetic live still.",
        "Bon Scott aggressive early live performance leap or snarl",
        [
            "Bon Scott AC/DC live aggressive 1977",
            "Bon Scott stage fight energy 1970s",
            "Bon Scott early tour snarl microphone",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1976",
        date_to="1978",
    ),
    "m008": _hist(
        "'Swimming upstream' — early era sweat, chaos, uphill fight; peak physical Bon.",
        "Bon Scott early AC/DC live — chaotic energy, crowd surf, raw power",
        [
            "Bon Scott AC/DC 1977 live crowd energy",
            "Bon Scott early tour sweat stage 1970s",
            "AC/DC live 1978 Bon Scott jumping",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1976",
        date_to="1978",
    ),
    "m009": _hist(
        "Highway to Hell shift — looser, warmer, leaning back. 1979 Bon relaxed on stage.",
        "Bon Scott 1979 live relaxed leaning back microphone — downstream calm",
        [
            "Bon Scott 1979 live relaxed performance",
            "Bon Scott Highway to Hell tour leaning microphone",
            "Bon Scott 1979 stage calm expression",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m010": _artifact(
        "NOT alcohol — reject beer-sloppy cliché. Whisky glass out of focus or empty bar stool; "
        "documentary contrast to 'inebriated' voice claim.",
        "whisky glass on bar counter",
        "Alcohol myth vs actual vocal quality",
        [
            "whisky glass bar counter 1970s photograph",
            "empty bar stool dim pub 1970s",
            "beer bottles blurred background documentary",
        ],
        date_from="1970",
        date_to="1980",
        avoid=DEFAULT_AVOID + ["party celebration", "glamorized drinking"],
    ),
    "m011": _hist(
        "'Supernatural nonchalance' — Bon backstage or live, eerie calm amid chaos.",
        "Bon Scott backstage calm 1979 — detached, knowing expression",
        [
            "Bon Scott backstage 1979 candid calm",
            "Bon Scott 1979 portrait relaxed eyes",
            "Bon Scott AC/DC offstage 1979",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m012": _text(
        "Lyric punch — type the highway lines on grain; VO quotes the song.",
        "transcription",
        "NO STOP SIGNS · PAYING MY DUES · HIGHWAY TO HELL",
        "typewriter",
    ),
    "m013": _hist(
        "Acceptance / momentum — Bon not resisting; highway forward motion metaphor.",
        "Bon Scott 1979 live — arms open, surrender to the performance",
        [
            "Bon Scott 1979 live arms spread stage",
            "Bon Scott Highway to Hell performance acceptance",
            "highway road night photograph 1970s metaphor",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m014": _hist(
        "'His best work' — studio or stage peak 1979; pivot into folklore story.",
        "AC/DC Highway to Hell sessions or tour — creative peak 1979",
        [
            "AC/DC studio 1979 recording session",
            "Bon Scott 1979 creative peak live",
            "AC/DC band studio 1979 photograph",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}, {"name": "AC/DC", "role": "band"}],
        date_from="1979",
        date_to="1979",
    ),
    "m015": _hist(
        "Rock scene folklore — musicians trading stories backstage; myth everyone knew.",
        "1970s rock musicians backstage talking — scene folklore, not AC/DC literal",
        [
            "1970s rock musicians backstage photograph",
            "rock and roll backstage 1970s candid",
            "musicians talking backstage 1970s tour",
        ],
        date_from="1965",
        date_to="1979",
        priority="medium",
    ),
    "m016": _hist(
        "Crossroads setup — 1931 Mississippi night; heat, isolation, date anchor.",
        "Mississippi Delta rural road night 1930s — crossroads atmosphere",
        [
            "Mississippi Delta dirt road 1930s photograph",
            "Mississippi crossroads rural night historical",
            "Delta blues Mississippi countryside 1930s",
        ],
        date_from="1930",
        date_to="1935",
        location="Mississippi, USA",
        avoid=DEFAULT_AVOID + ["modern highway", "suburban"],
    ),
    "m017": _hist(
        "Lonely intersection — insects, heat, dirt road; young musician waiting.",
        "Rural crossroads intersection Mississippi — empty, humid night mood",
        [
            "Mississippi crossroads intersection photograph",
            "Delta blues rural road intersection",
            "lonely dirt road southern USA night",
        ],
        date_from="1930",
        date_to="1935",
        location="Mississippi, USA",
    ),
    "m018": _hist(
        "Robert Johnson with guitar — hunger for greatness; ONLY Johnson-era imagery from here.",
        "Robert Johnson guitarist portrait or with guitar 1930s",
        [
            "Robert Johnson blues guitarist photograph",
            "Robert Johnson with guitar 1930s",
            "Robert Johnson portrait blues musician",
        ],
        people=[{"name": "Robert Johnson", "role": "blues musician"}],
        date_from="1935",
        date_to="1938",
        location="Mississippi, USA",
    ),
    "m019": _hist(
        "Dark figure at crossroads — folklore illustration or high-contrast silhouette; tasteful, not horror B-movie.",
        "Crossroads devil folklore — silhouette at rural intersection, blues myth",
        [
            "Robert Johnson crossroads legend illustration",
            "crossroads blues devil folklore art",
            "silhouette figure rural road night",
        ],
        date_from="1930",
        date_to="1940",
        avoid=DEFAULT_AVOID + ["horror movie monster", "cartoon devil horns comedy"],
        priority="medium",
    ),
    "m020": _hist(
        "Impossibly good guitar — Johnson transformed; hands on guitar close-up.",
        "Robert Johnson playing guitar — supernatural skill folklore moment",
        [
            "Robert Johnson playing guitar photograph",
            "blues guitarist hands guitar close up 1930s",
            "Robert Johnson performance photograph",
        ],
        people=[{"name": "Robert Johnson", "role": "blues musician"}],
        date_from="1936",
        date_to="1938",
    ),
    "m021": _text(
        "'It ain't free' — contract/bargain beat; intertitle on grain.",
        "quote",
        "BUT UNDERSTAND, KID — IT AIN'T FREE.",
        "typewriter",
    ),
    "m022": _hist(
        "Johnson returns transformed — other musicians stunned; delta blues scene.",
        "Robert Johnson 1930s — post-legend transformation, peers watching",
        [
            "Robert Johnson blues musician 1937",
            "Mississippi juke joint musicians 1930s",
            "Robert Johnson contemporaries blues scene",
        ],
        people=[{"name": "Robert Johnson", "role": "blues musician"}],
        date_from="1936",
        date_to="1938",
    ),
    "m023": _hist(
        "Supernatural voice & fame promised — Johnson performing, otherworldly intensity.",
        "Robert Johnson singing or performing — intense, legendary presence",
        [
            "Robert Johnson blues performance photograph",
            "Robert Johnson portrait intense",
            "blues singer 1930s Mississippi performance",
        ],
        people=[{"name": "Robert Johnson", "role": "blues musician"}],
        date_from="1936",
        date_to="1938",
    ),
    "m024": _hist(
        "Johnson died young — legend only after death; grave or memorial.",
        "Robert Johnson grave or death memorial — died before fame",
        [
            "Robert Johnson grave Mississippi",
            "Robert Johnson death memorial blues",
            "Robert Johnson 1938 obituary newspaper",
        ],
        people=[{"name": "Robert Johnson", "role": "blues musician"}],
        date_from="1938",
        date_to="1938",
    ),
    "m025": _hist(
        "27 Club roll call — Hendrix, Joplin, Morrison, Cobain; one face per beat if montage.",
        "27 Club musicians — Hendrix, Joplin, Morrison, Cobain era photographs",
        [
            "Jimi Hendrix 1969 photograph",
            "Janis Joplin 1970 photograph",
            "Jim Morrison 1971 photograph",
            "Kurt Cobain 1990s photograph",
        ],
        date_from="1969",
        date_to="1994",
        avoid=DEFAULT_AVOID + ["wrong artist mislabeled", "tribute collage poster"],
    ),
    "m026": _hist(
        "Soul for fame equation — same bargain, different eras; crossroads echo.",
        "Rock mythology — fame and early death, artistic sacrifice",
        [
            "rock star spotlight 1970s silhouette",
            "musician backstage alone 1970s",
            "crossroads blues rock mythology photograph",
        ],
        date_from="1960",
        date_to="1980",
        priority="medium",
    ),
    "m027": _artifact(
        "Dark wit — 'got their money's worth' — gold/platinum, not another face.",
        "gold record award plaque",
        "27 Club fame vs cost — money's worth",
        [
            "gold record award disc close up",
            "RIAA gold album plaque 1970s",
            "platinum record award wall 1980s",
        ],
    ),
    "m028": _text(
        "Bon wasn't 27 — numeric punch; breaks club mythology.",
        "title",
        "33.",
        "minimal_white",
    ),
    "m029": _text(
        "Section turn — devil reveal setup.",
        "intertitle",
        "SO WHO IS THE DEVIL?",
        "blockbuster",
    ),
    "m030": _artifact(
        "'Tip of a hypodermic needle' — macro, clinical, NOT glamorized.",
        "hypodermic needle macro",
        "Heroin as the modern devil bargain",
        [
            "hypodermic needle macro photograph documentary",
            "syringe close up medical still life",
            "needle tip macro black background",
        ],
        avoid=DEFAULT_AVOID + ["injection in arm", "glamorized drug use", "blood"],
        media_preference="photo",
    ),
    "m031": _hist(
        "Heroin bargain — lucid then ruin; 70s rock documentary tone, not exploitation.",
        "1970s rock culture heroin documentary context — era photography",
        [
            "1970s rock culture documentary photograph",
            "New York music scene 1970s backstage",
            "London rock scene 1970s nightlife",
        ],
        date_from="1970",
        date_to="1979",
        avoid=DEFAULT_AVOID + ["graphic drug use", "needle in vein"],
        priority="medium",
    ),
    "m032": _artifact(
        "'Bargain in chemical form' — spoon, kit, or record-collection metaphor.",
        "record collection vinyl stack",
        "Heroin in rock history — your record collection",
        [
            "vinyl record collection shelf 1970s",
            "album collection bedroom 1970s photograph",
            "stack of LPs close up 1970s",
        ],
    ),
    "m033": _hist(
        "'60s–'90s artists in the grip' — named-era montage; studio circles, not needles.",
        "Rock musicians 1970s studio and afterparty culture",
        [
            "rock musicians 1970s studio session",
            "1970s recording studio musicians photograph",
            "rock band afterparty 1970s",
        ],
        date_from="1965",
        date_to="1990",
        priority="medium",
    ),
    "m034": _hist(
        "Some survived, some paid — contrast portraits; documentary sobriety.",
        "Rock survivors vs casualties — era press, funerals, comebacks",
        [
            "rock musician funeral 1970s newspaper",
            "Eric Clapton 1970s photograph",
            "Keith Richards 1970s live photograph",
        ],
        date_from="1970",
        date_to="1980",
    ),
    "m035": _hist(
        "Late 70s heroin saturation — elite rooms, not fringe.",
        "1970s music industry party studio — heroin era context",
        [
            "Studio 54 1970s photograph",
            "1970s music industry party photograph",
            "New York nightclub 1970s rock scene",
        ],
        date_from="1977",
        date_to="1979",
        location="New York / Los Angeles",
    ),
    "m036": _hist(
        "After parties and studio circles — heroin moved through working bands.",
        "Rock band backstage afterparty 1970s — industry access",
        [
            "rock band backstage 1970s afterparty",
            "recording studio late night 1970s",
            "tour bus backstage 1970s musicians",
        ],
        date_from="1975",
        date_to="1979",
    ),
    "m037": _hist(
        "John Lennon spoke about it — Lennon era press, not Bon.",
        "John Lennon 1970s press photograph",
        [
            "John Lennon 1970s photograph interview",
            "John Lennon New York 1970s",
            "John Lennon studio 1970s",
        ],
        people=[{"name": "John Lennon", "role": "musician"}],
        date_from="1970",
        date_to="1980",
    ),
    "m038": _hist(
        "Clapton, Reed, Richards — documented rock heroin history; correct artist each.",
        "Eric Clapton, Lou Reed, Keith Richards — 1970s era photographs",
        [
            "Eric Clapton 1970s photograph",
            "Lou Reed 1970s New York photograph",
            "Keith Richards 1970s Rolling Stones",
        ],
        people=[
            {"name": "Eric Clapton", "role": "musician"},
            {"name": "Lou Reed", "role": "musician"},
            {"name": "Keith Richards", "role": "musician"},
        ],
        date_from="1970",
        date_to="1979",
    ),
    "m039": _text(
        "Documented history — not fantasy; stamp the argument.",
        "quote",
        "IT'S DOCUMENTED ROCK HISTORY.",
        "newspaper",
    ),
    "m040": _hist(
        "Would Bon be *around* heroin? — London 1979 nightlife, his circles, not accusation graphic.",
        "Bon Scott London 1979 — clubs, tour life, proximity not proof",
        [
            "Bon Scott London 1979 photograph",
            "Bon Scott AC/DC 1979 offstage nightlife",
            "London music scene 1979 rock",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1980",
        location="London, UK",
    ),
    "m041": _hist(
        "Final stretch — experimentation vs dependency; intimate Bon 1979, ambiguous.",
        "Bon Scott 1979 late period — tired, private, final months mood",
        [
            "Bon Scott 1979 candid portrait",
            "Bon Scott February 1980 era photograph",
            "Bon Scott London 1979 tired",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1980",
    ),
    "m042": _text(
        "'Hmm, you decide' — hand verdict to viewer; whitespace beat.",
        "quote",
        "YOU DECIDE.",
        "minimal_white",
        priority="medium",
    ),
    "m043": _hist(
        "Death night — February 1980 London, night out; cold urban night mood.",
        "London February 1980 night street — cold, wet, urban",
        [
            "London street night 1980 photograph",
            "London February winter night 1980s",
            "UK pub exterior night 1980",
        ],
        date_from="1980",
        date_to="1980",
        location="London, UK",
        people=[{"name": "Bon Scott", "role": "vocalist"}],
    ),
    "m044": _hist(
        "Left in car, found next day — parked car winter, official alcohol narrative.",
        "Parked car winter night London — left overnight tragedy",
        [
            "parked car snow winter night 1980s",
            "car interior back seat night photograph",
            "London winter street parked cars 1980",
        ],
        date_from="1980",
        date_to="1980",
        location="London, UK",
        avoid=DEFAULT_AVOID + ["graphic death scene", "corpse"],
    ),
    "m045": _hist(
        "Thin public record — newspaper headline, inquest, missing details.",
        "Bon Scott death newspaper headline February 1980",
        [
            "Bon Scott death newspaper 1980 headline",
            "Bon Scott obituary 1980 newspaper",
            "AC/DC Bon Scott death news 1980",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1980",
        date_to="1980",
        priority="high",
    ),
    "m046": _hist(
        "'He drank too much' — bar culture yes, but skeptical undertone; veteran drinker.",
        "Bon Scott drinking pub 1970s — known drinker, not moralizing",
        [
            "Bon Scott drinking beer pub 1970s",
            "Bon Scott bar candid 1970s",
            "rock musician pub 1970s documentary",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1975",
        date_to="1980",
    ),
    "m047": _hist(
        "Incomplete vs plausible alternative — coroner file, redacted document mood.",
        "Official records incomplete — coroner document or redacted file aesthetic",
        [
            "coroner report document photograph",
            "redacted government document",
            "manila folder classified stamp",
        ],
        avoid=DEFAULT_AVOID + ["fake specific Bon document if fabricated"],
        priority="medium",
    ),
    "m048": _hist(
        "Friend left him in the car — guilt, abandonment; car in cold night.",
        "Friend's car winter night — left alone, troubling decision",
        [
            "car parked alley winter night",
            "sleeping in car winter photograph",
            "friend leaving car night street",
        ],
        date_from="1980",
        date_to="1980",
        location="London, UK",
        priority="medium",
    ),
    "m049": _hist(
        "February freezing — London cold emphasis; breath, frost, harsh weather.",
        "London winter February frost cold night 1980",
        [
            "London snow February 1980",
            "London winter frost street night",
            "freezing cold urban night UK 1980s",
        ],
        date_from="1980",
        date_to="1980",
        location="London, UK",
    ),
    "m050": _hist(
        "Not checked until afternoon — clock, late sun, delay that makes no sense.",
        "Afternoon light — time passed, delayed discovery",
        [
            "wall clock afternoon photograph",
            "winter afternoon light window",
            "alarm clock afternoon bedside",
        ],
        date_from="1980",
        date_to="1980",
        priority="medium",
    ),
    "m051": _hist(
        "Why cover up heroin OD? — media machine, silence, 1980 gatekeepers.",
        "1980 media silence — radio studio, newspaper editor, gatekeeper",
        [
            "FM radio station studio 1980",
            "newspaper editor office 1980",
            "1980 music industry executive photograph",
        ],
        date_from="1980",
        date_to="1980",
    ),
    "m052": _hist(
        "1980 media narratives — heroin tied to 'alien' subcultures; year stamp.",
        "1980 American media culture — news magazine, rock press",
        [
            "Rolling Stone magazine 1980 cover",
            "1980 news broadcast television studio",
            "music magazine 1980 rock",
        ],
        date_from="1980",
        date_to="1980",
    ),
    "m053": _hist(
        "Disco, queer, art scene — stigma geography; Studio 54 era, NOT homophobic caricature.",
        "Studio 54 disco era 1979 — nightlife mainstream rock feared",
        [
            "Studio 54 1979 photograph",
            "disco nightclub 1979 New York",
            "1979 disco dance floor photograph",
        ],
        date_from="1978",
        date_to="1980",
        location="New York, USA",
        avoid=DEFAULT_AVOID + ["homophobic caricature", "mocking LGBTQ"],
    ),
    "m054": _hist(
        "AC/DC conquering America — US tour crowd, denim, heartland 1980.",
        "AC/DC American tour 1980 crowd — mainstream rock audience",
        [
            "AC/DC US tour 1980 crowd",
            "AC/DC American audience 1980 concert",
            "rock concert USA 1980 denim crowd",
        ],
        people=[{"name": "AC/DC", "role": "band"}],
        date_from="1980",
        date_to="1980",
        location="USA",
    ),
    "m055": _hist(
        "Demographic — working class, suburban, beer, denim; heartland not coastal elite.",
        "American working class rock fans 1980 — beer, denim, trucks",
        [
            "American rock concert crowd 1980 denim",
            "suburban teenagers rock concert 1980",
            "pickup truck tailgate beer 1980s photograph",
        ],
        date_from="1979",
        date_to="1981",
        location="USA",
    ),
    "m056": _hist(
        "Anti-disco — Disco Demolition Night Comiskey Park July 1979; cultural war.",
        "Disco Demolition Night Comiskey Park July 1979",
        [
            "Disco Demolition Night 1979 Comiskey Park",
            "Steve Dahl disco demolition 1979",
            "disco records explosion baseball field 1979",
        ],
        date_from="1979",
        date_to="1979",
        location="Chicago, USA",
    ),
    "m057": _hist(
        "Heroin reads as downtown / art scene — Velvet Underground, Warhol factory echo.",
        "New York downtown art scene 1970s — Lou Reed era, bohemian",
        [
            "Andy Warhol factory 1970s photograph",
            "Velvet Underground era New York 1970s",
            "downtown Manhattan 1970s nightlife",
        ],
        date_from="1970",
        date_to="1980",
        location="New York, USA",
        people=[{"name": "Lou Reed", "role": "musician"}],
    ),
    "m058": _hist(
        "Cultural betrayal fear — AC/DC heartland fan vs downtown junkie stereotype (documentary, not mockery).",
        "Contrast — stadium rock crowd vs downtown 1970s street",
        [
            "stadium rock crowd 1980 USA",
            "New York City street 1970s documentary",
            "rock fan denim concert vs city nightlife split",
        ],
        date_from="1979",
        date_to="1980",
        avoid=DEFAULT_AVOID + ["homeless mockery", "poverty tourism"],
    ),
    "m059": _hist(
        "Heroin story = betrayal of AC/DC brand — band as working-class joy machine.",
        "AC/DC live joy 1979 — emphatically present, turned up to eleven",
        [
            "AC/DC live 1979 crowd joy energy",
            "Angus Young AC/DC 1979 stage energy",
            "AC/DC concert audience hands up 1979",
        ],
        people=[{"name": "AC/DC", "role": "band"}],
        date_from="1979",
        date_to="1979",
    ),
    "m060": _artifact(
        "Back in Black coming — LP object, avoid trademark cover if possible; sleeve or vinyl edge.",
        "Back in Black vinyl record sleeve",
        "Album about to ship — commercial stakes",
        [
            "Back in Black vinyl record 1980",
            "AC/DC Back in Black album sleeve 1980",
            "black vinyl LP 1980 Atlantic Records",
        ],
        date_from="1980",
        date_to="1980",
        avoid=DEFAULT_AVOID + ["Brian Johnson prominent cover portrait"],
    ),
    "m061": _hist(
        "Radio gatekeepers 1980 — conservative program directors, advertisers.",
        "FM radio station program director 1980 office",
        [
            "FM radio station 1980 control room",
            "radio program director office 1980",
            "American radio station studio 1980",
        ],
        date_from="1980",
        date_to="1980",
        location="USA",
    ),
    "m062": _hist(
        "Advertisers risk-averse — Chevrolet commercial era, brand safety.",
        "1980 television commercial production — advertiser friendly",
        [
            "1980 car commercial television still",
            "advertising agency 1980 meeting",
            "Chevrolet advertisement 1980",
        ],
        date_from="1980",
        date_to="1980",
        avoid=DEFAULT_AVOID + ["specific living executive faces"],
        priority="medium",
    ),
    "m063": _hist(
        "Five months later — Back in Black everywhere; Brian era begins.",
        "Back in Black record store display 1980 America",
        [
            "record store 1980 album display",
            "Back in Black record store 1980",
            "Tower Records 1980 interior",
        ],
        date_from="1980",
        date_to="1981",
        location="USA",
        people=[{"name": "AC/DC", "role": "band"}],
    ),
    "m064": _artifact(
        "Fifty million copies — gold/platinum wall, money on the line.",
        "platinum album award multiple gold records",
        "Back in Black sales — incentive for simple story",
        [
            "platinum record award 50 million",
            "gold record wall multiple awards",
            "RIAA diamond album award",
        ],
    ),
    "m065": _hist(
        "No conspiracy committee — self-preservation, everyone choosing easy story.",
        "Business meeting handshake — informal alignment, not smoke-filled room",
        [
            "business handshake meeting 1980 photograph",
            "record label meeting 1980",
            "music industry executives meeting 1980s",
        ],
        date_from="1980",
        date_to="1985",
        avoid=DEFAULT_AVOID + ["literal conspiracy thriller imagery"],
        priority="medium",
    ),
    "m066": _text(
        "Thesis return — question on grain over Bon plate or black.",
        "quote",
        "DID BON SCOTT KNOW HE WAS GOING TO DIE?",
        "typewriter",
    ),
    "m067": _hist(
        "'Bill coming due' — Bon still playing, devil at heels; 1979 live momentum.",
        "Bon Scott 1979 live — still performing, fate closing in",
        [
            "Bon Scott 1979 live intense performance",
            "Bon Scott Highway to Hell tour running stage",
            "Bon Scott 1979 microphone forward motion",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
    ),
    "m068": _hist(
        "'We consumed it as entertainment' — crowd, tickets, spectacle complicit.",
        "Rock concert audience 1979 — consumption, cheering, complicity",
        [
            "rock concert crowd cheering 1979",
            "concert tickets hands 1970s",
            "stadium audience rock show 1979",
        ],
        date_from="1979",
        date_to="1980",
        priority="medium",
    ),
    "m069": _hist(
        "Closing command — play it loud; definitive Highway to Hell tour Bon, full energy.",
        "Bon Scott Highway to Hell live 1979 — final statement, mic forward",
        [
            "Bon Scott Highway to Hell live 1979",
            "Bon Scott AC/DC 1979 tour finale energy",
            "Bon Scott singing highway to hell live",
        ],
        people=[{"name": "Bon Scott", "role": "vocalist"}],
        date_from="1979",
        date_to="1979",
        priority="high",
        media_type="photo",
    ),
}


def _engine_for_mode(visual_mode: str) -> tuple[str, str]:
    if visual_mode == "text_graphic":
        return (
            "google",
            "https://www.google.com/search?tbm=isch&q={query}",
        )
    if visual_mode == "stock":
        return (
            "openverse",
            "https://openverse.org/search/?q={query}",
        )
    return (
        "commons",
        "https://commons.wikimedia.org/w/index.php?search={query}",
    )


def sync_acquisitions(data: dict[str, Any]) -> int:
    """Push manifest queries into per-cue acquisition.json (keep selections/notes)."""
    by_id = {i["id"]: i for i in data["items"]}
    media_root = REPO / "media_tool/public/media/002_DidBonScottKnowHeWasGoingToDie"
    updated = 0

    for item_id, manifest_item in by_id.items():
        acq_path = media_root / item_id / "acquisition.json"
        if not acq_path.is_file():
            continue

        acq = json.loads(acq_path.read_text(encoding="utf-8"))
        mode = manifest_item["visual_mode"]
        engine_id, engine_url = _engine_for_mode(mode)

        if mode == "text_graphic":
            queries = ["(text graphic — no archive search)"]
        elif manifest_item.get("search_queries"):
            queries = manifest_item["search_queries"]
        else:
            queries = [manifest_item.get("situation") or manifest_item.get("editorial_intent", "")[:80]]

        old_queries = acq.get("queries") or []
        new_query_rows = []
        for qi, query in enumerate(queries):
            prev = old_queries[qi] if qi < len(old_queries) else {}
            new_query_rows.append(
                {
                    "query_index": qi,
                    "query": query,
                    "engine_id": prev.get("engine_id") or engine_id,
                    "engine_url": prev.get("engine_url") or engine_url,
                    "selections": prev.get("selections") or [],
                }
            )

        acq["source_visual_mode"] = mode
        acq["queries"] = new_query_rows
        if manifest_item.get("text_graphic"):
            acq["text_graphic"] = manifest_item["text_graphic"]
        if mode == "text_graphic":
            acq["resolved_visual_mode"] = "text_graphic"
            if acq.get("status") == "pending":
                acq["status"] = "text_graphic"
        elif acq.get("status") == "pending":
            acq["resolved_visual_mode"] = mode

        acq_path.write_text(json.dumps(acq, indent=2) + "\n", encoding="utf-8")
        updated += 1

    return updated


def apply() -> dict[str, Any]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    items = data["items"]

    for item in items:
        cue_id = item["id"]
        if cue_id == "m070":
            item["editorial_intent"] = (
                "2s black tail after final VO cue (m069) — picture hold only; "
                "master audio ends with m069."
            )
            continue
        if cue_id not in EDITORIAL:
            continue
        patch = EDITORIAL[cue_id]
        for key, value in patch.items():
            item[key] = deepcopy(value)

    # Recompute header counts
    modes = [i["visual_mode"] for i in items if i["id"] not in ("m000", "m070")]
    data["historical_count"] = sum(1 for m in modes if m == "historical")
    data["artifact_count"] = sum(1 for m in modes if m == "artifact")
    data["text_graphic_count"] = sum(1 for m in modes if m == "text_graphic")
    data["notes"] = (
        "Episode 002 editorial pass: devil's bargain / voice shift / Robert Johnson crossroads / "
        "heroin as chemical devil / Bon death investigation / 1980 cultural stigma / Back in Black "
        "commercial silence. visual_mode mix per ep001 grammar — historical + artifact + text_graphic "
        "whitespace. Avoid literal album covers, stock explainer, glamorized drugs."
    )

    MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return data


def main() -> None:
    data = apply()
    n = sync_acquisitions(data)
    print(f"Synced {n} acquisition.json files")
    # Regenerate CSV exports
    sys.path.insert(0, str(REPO / "tools"))
    from build_media_search import write_csv, write_photos_only_csv  # noqa: E402

    timeline = MANIFEST.parent
    write_csv(timeline / "media_search.csv", data)
    write_photos_only_csv(timeline / "media_search_photos_only.csv", data)

    modes: dict[str, int] = {}
    for item in data["items"]:
        if item["id"] in ("m000", "m070"):
            continue
        m = item["visual_mode"]
        modes[m] = modes.get(m, 0) + 1
    print(f"Updated {MANIFEST}")
    print("Mode counts:", modes)


if __name__ == "__main__":
    main()
