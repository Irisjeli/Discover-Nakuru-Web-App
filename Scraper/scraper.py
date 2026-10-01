# ============================================================
# NAKURU WEB DISCOVERY CRAWLER
# STAGE 1 - FREE VERSION
#
# Uses:
#   OpenStreetMap
#   Overpass API
#   Local Nakuru County shapefile
#
# IMPORTANT:
#   The Nakuru County boundary is NOT downloaded from OSM.
#
#   Instead, this script uses:
#
#   C:\Users\USER\Downloads\portfolio\Shapefiles\
#       Nakuru_County.shp
#
#   OSM places are first discovered using a broad bounding box
#   and are then CLIPPED using the actual Nakuru County boundary.
#
# ============================================================

import json
import time
from pathlib import Path

import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point


# ============================================================
# 1. PROJECT LOCATION
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent

PROJECT_DIR = SCRIPT_DIR.parent


# ============================================================
# 2. NAKURU COUNTY SHAPEFILE
# ============================================================

BOUNDARY_FILE = Path(
    r"C:\Users\USER\Downloads\portfolio\Shapefiles\Nakuru_County.shp"
)


# ============================================================
# 3. DATA FOLDERS
# ============================================================

WEB_DATA_DIR = PROJECT_DIR / "data"

NAKURU_DATA_DIR = (
    WEB_DATA_DIR / "nakuru"
)


SCRAPER_DATA_DIR = (
    SCRIPT_DIR / "Data"
)


DISCOVERY_DIR = (
    SCRAPER_DATA_DIR / "Discovery"
)


RAW_HTML_DIR = (
    SCRAPER_DATA_DIR / "Raw" / "HTML"
)


IMAGES_DIR = (
    SCRAPER_DATA_DIR / "Images"
)


PROCESSED_DIR = (
    SCRAPER_DATA_DIR / "Processed"
)


# ============================================================
# 4. CREATE FOLDERS
# ============================================================

folders_to_create = [

    WEB_DATA_DIR,

    NAKURU_DATA_DIR,

    SCRAPER_DATA_DIR,

    DISCOVERY_DIR,

    RAW_HTML_DIR,

    IMAGES_DIR,

    PROCESSED_DIR,

]


for folder in folders_to_create:

    folder.mkdir(
        parents=True,
        exist_ok=True
    )


# ============================================================
# 5. SETTINGS
# ============================================================

OVERPASS_URL = (
    "https://overpass-api.de/api/interpreter"
)


REQUEST_DELAY = 5


TIMEOUT = 180


USER_AGENT = (
    "NakuruGISPortfolio/1.0 "
    "(OpenStreetMap data discovery for GIS portfolio)"
)


# ============================================================
# 6. BROAD SEARCH BOUNDING BOX
# ============================================================
#
# This is ONLY used to find candidate OSM features.
#
# The actual Nakuru County shapefile will later be used to
# remove anything outside the county.
#
# south, west, north, east
#
# ============================================================

SEARCH_BBOX = (
    -1.65,
    35.50,
    -0.05,
    36.95
)


# ============================================================
# 7. OSM CATEGORIES
# ============================================================

CATEGORIES = {

    # --------------------------------------------------------
    # TOURIST / SCENIC
    # --------------------------------------------------------

    "TOURISM": [

        ("tourism", "attraction"),

        ("tourism", "viewpoint"),

        ("tourism", "museum"),

        ("tourism", "gallery"),

        ("tourism", "information"),

        ("tourism", "zoo"),

        ("tourism", "theme_park"),

        ("tourism", "picnic_site"),

    ],


    # --------------------------------------------------------
    # HOTELS / ACCOMMODATION
    # --------------------------------------------------------

    "ACCOMMODATION": [

        ("tourism", "hotel"),

        ("tourism", "hostel"),

        ("tourism", "guest_house"),

        ("tourism", "motel"),

        ("tourism", "chalet"),

        ("tourism", "camp_site"),

        ("tourism", "caravan_site"),

        ("tourism", "resort"),

        ("tourism", "alpine_hut"),

    ],


    # --------------------------------------------------------
    # RESTAURANTS / FOOD
    # --------------------------------------------------------

    "FOOD_DRINK": [

        ("amenity", "restaurant"),

        ("amenity", "cafe"),

        ("amenity", "fast_food"),

        ("amenity", "food_court"),

        ("amenity", "ice_cream"),

        ("amenity", "pub"),

        ("amenity", "bar"),

    ],


    # --------------------------------------------------------
    # SHOPPING
    # --------------------------------------------------------

    "SHOPPING": [

        ("shop", "supermarket"),

        ("shop", "mall"),

        ("shop", "department_store"),

        ("shop", "convenience"),

        ("shop", "market"),

        ("amenity", "marketplace"),

    ],


    # --------------------------------------------------------
    # HERITAGE
    # --------------------------------------------------------

    "CULTURE_HERITAGE": [

        ("historic", "monument"),

        ("historic", "memorial"),

        ("historic", "archaeological_site"),

        ("historic", "ruins"),

        ("historic", "castle"),

        ("historic", "building"),

        ("historic", "fort"),

        ("historic", "wayside_cross"),

        ("amenity", "arts_centre"),

    ],


    # --------------------------------------------------------
    # NATURE
    # --------------------------------------------------------

    "NATURE": [

        ("leisure", "nature_reserve"),

        ("leisure", "park"),

        ("leisure", "garden"),

        ("boundary", "national_park"),

        ("boundary", "protected_area"),

    ],


    # --------------------------------------------------------
    # SPORT / RECREATION
    # --------------------------------------------------------

    "SPORT_RECREATION": [

        ("leisure", "sports_centre"),

        ("leisure", "stadium"),

        ("leisure", "pitch"),

        ("leisure", "swimming_pool"),

        ("leisure", "golf_course"),

        ("leisure", "fitness_centre"),

        ("leisure", "marina"),

        ("leisure", "playground"),

        ("leisure", "water_park"),

    ],


    # --------------------------------------------------------
    # RELIGIOUS / WORSHIP
    # --------------------------------------------------------

    "RELIGIOUS_SITES": [

        ("amenity", "place_of_worship"),

    ],

}


# ============================================================
# 8. HTTP SESSION
# ============================================================

session = requests.Session()


session.headers.update({

    "User-Agent": USER_AGENT,

    "Accept": "application/json",

})


# ============================================================
# 9. LOAD NAKURU COUNTY BOUNDARY
# ============================================================

def load_nakuru_boundary():

    print()
    print("=" * 70)
    print("LOADING NAKURU COUNTY BOUNDARY")
    print("=" * 70)

    print()
    print("Boundary file:")
    print(BOUNDARY_FILE)

    if not BOUNDARY_FILE.exists():

        raise FileNotFoundError(

            f"""
Nakuru County shapefile was not found.

Expected file:

{BOUNDARY_FILE}

Please check that the file exists.
"""

        )


    print()
    print("Reading shapefile...")


    boundary = gpd.read_file(
        BOUNDARY_FILE
    )


    if boundary.empty:

        raise RuntimeError(
            "The Nakuru County shapefile is empty."
        )


    print()
    print(
        f"Boundary features found: "
        f"{len(boundary)}"
    )


    print()
    print(
        f"Original CRS: "
        f"{boundary.crs}"
    )


    # --------------------------------------------------------
    # Make sure the shapefile has a CRS
    # --------------------------------------------------------

    if boundary.crs is None:

        raise RuntimeError(

            """
The Nakuru County shapefile does not have a
defined coordinate reference system.

Please make sure the .prj file exists beside
Nakuru_County.shp.
"""

        )


    # --------------------------------------------------------
    # Convert boundary to WGS84
    #
    # OSM coordinates are latitude/longitude.
    # EPSG:4326 = WGS84.
    # --------------------------------------------------------

    boundary = boundary.to_crs(
        epsg=4326
    )


    # --------------------------------------------------------
    # Repair invalid geometries
    # --------------------------------------------------------

    print()
    print("Checking boundary geometry...")


    boundary["geometry"] = (
        boundary.geometry
        .buffer(0)
    )


    # --------------------------------------------------------
    # Merge all boundary features
    # --------------------------------------------------------

    nakuru_geometry = (
        boundary.geometry
        .union_all()
    )


    if nakuru_geometry.is_empty:

        raise RuntimeError(
            "The Nakuru County boundary geometry is empty."
        )


    print()
    print("Nakuru County boundary loaded successfully.")


    bounds = nakuru_geometry.bounds


    print()
    print("Actual Nakuru County bounds:")

    print(
        f"West:  {bounds[0]}"
    )

    print(
        f"South: {bounds[1]}"
    )

    print(
        f"East:  {bounds[2]}"
    )

    print(
        f"North: {bounds[3]}"
    )


    return nakuru_geometry


# ============================================================
# 10. CREATE OVERPASS QUERY
# ============================================================

def create_overpass_query(tags):

    south, west, north, east = SEARCH_BBOX


    bbox = (
        f"{south},{west},{north},{east}"
    )


    statements = []


    for key, value in tags:

        statements.append(

            f'nwr["{key}"="{value}"]({bbox});'

        )


    query_body = "\n".join(
        statements
    )


    query = f"""
[out:json][timeout:120];

(
{query_body}
);

out center tags;
"""


    return query


# ============================================================
# 11. RUN OVERPASS QUERY
# ============================================================

def run_overpass_query(
    query,
    category
):

    print()
    print("-" * 70)

    print(
        "Querying OpenStreetMap:"
    )

    print(
        category
    )

    print("-" * 70)


    try:

        response = session.post(

            OVERPASS_URL,

            data=query,

            timeout=TIMEOUT

        )


        print(
            f"HTTP status: "
            f"{response.status_code}"
        )


        response.raise_for_status()


        data = response.json()


        elements = data.get(
            "elements",
            []
        )


        print(
            f"Elements returned: "
            f"{len(elements)}"
        )


        return elements


    except requests.exceptions.RequestException as error:

        print()
        print(
            "Overpass request failed:"
        )

        print(error)


        return []


    except ValueError:

        print()
        print(
            "Could not decode Overpass response."
        )


        return []


# ============================================================
# 12. GET COORDINATES
# ============================================================

def get_coordinates(element):

    element_type = element.get(
        "type"
    )


    lat = None

    lon = None


    # --------------------------------------------------------
    # NODE
    # --------------------------------------------------------

    if element_type == "node":

        lat = element.get(
            "lat"
        )

        lon = element.get(
            "lon"
        )


    # --------------------------------------------------------
    # WAY / RELATION
    # --------------------------------------------------------

    elif element_type in (
        "way",
        "relation"
    ):

        center = element.get(
            "center",
            {}
        )


        lat = center.get(
            "lat"
        )

        lon = center.get(
            "lon"
        )


    return lat, lon


# ============================================================
# 13. BUILD ADDRESS
# ============================================================

def build_address(tags):

    address_parts = []


    address_keys = [

        "addr:housenumber",

        "addr:street",

        "addr:place",

        "addr:suburb",

        "addr:neighbourhood",

        "addr:city",

        "addr:town",

        "addr:village",

        "addr:county",

    ]


    for key in address_keys:

        value = tags.get(
            key
        )


        if value:

            address_parts.append(
                str(value)
            )


    return ", ".join(
        address_parts
    )


# ============================================================
# 14. EXTRACT PLACE
# ============================================================

def extract_place(
    element,
    category
):

    tags = element.get(
        "tags",
        {}
    )


    # --------------------------------------------------------
    # Name
    # --------------------------------------------------------

    name = (

        tags.get("name")

        or tags.get("official_name")

        or tags.get("alt_name")

        or ""

    )


    name = str(name).strip()


    if not name:

        return None


    # --------------------------------------------------------
    # Coordinates
    # --------------------------------------------------------

    lat, lon = get_coordinates(
        element
    )


    if lat is None or lon is None:

        return None


    try:

        lat = float(lat)

        lon = float(lon)

    except (
        TypeError,
        ValueError
    ):

        return None


    # --------------------------------------------------------
    # OSM information
    # --------------------------------------------------------

    osm_type = element.get(
        "type",
        ""
    )


    osm_id = element.get(
        "id"
    )


    # --------------------------------------------------------
    # Contact
    # --------------------------------------------------------

    website = (

        tags.get("website")

        or tags.get("contact:website")

        or ""

    )


    phone = (

        tags.get("phone")

        or tags.get("contact:phone")

        or ""

    )


    email = (

        tags.get("email")

        or tags.get("contact:email")

        or ""

    )


    # --------------------------------------------------------
    # Description
    # --------------------------------------------------------

    description = (

        tags.get("description")

        or tags.get("description:en")

        or ""

    )


    # --------------------------------------------------------
    # Opening hours
    # --------------------------------------------------------

    opening_hours = tags.get(
        "opening_hours",
        ""
    )


    # --------------------------------------------------------
    # Wikipedia
    # --------------------------------------------------------

    wikipedia = tags.get(
        "wikipedia",
        ""
    )


    # --------------------------------------------------------
    # Wikidata
    # --------------------------------------------------------

    wikidata = tags.get(
        "wikidata",
        ""
    )


    # --------------------------------------------------------
    # Address
    # --------------------------------------------------------

    address = build_address(
        tags
    )


    # --------------------------------------------------------
    # OSM URL
    # --------------------------------------------------------

    osm_url = (

        "https://www.openstreetmap.org/"

        f"{osm_type}/{osm_id}"

    )


    # --------------------------------------------------------
    # Extra useful OSM information
    # --------------------------------------------------------

    operator_name = (

        tags.get("operator")

        or ""

    )


    cuisine = (

        tags.get("cuisine")

        or ""

    )


    religion = (

        tags.get("religion")

        or ""

    )


    denomination = (

        tags.get("denomination")

        or ""

    )


    tourism = (

        tags.get("tourism")

        or ""

    )


    amenity = (

        tags.get("amenity")

        or ""

    )


    historic = (

        tags.get("historic")

        or ""

    )


    leisure = (

        tags.get("leisure")

        or ""

    )


    return {

        "name": name,

        "category": category,

        "osm_type": osm_type,

        "osm_id": osm_id,

        "latitude": lat,

        "longitude": lon,

        "address": address,

        "phone": phone,

        "email": email,

        "website": website,

        "opening_hours": opening_hours,

        "description": description,

        "wikipedia": wikipedia,

        "wikidata": wikidata,

        "osm_url": osm_url,

        "operator": operator_name,

        "cuisine": cuisine,

        "religion": religion,

        "denomination": denomination,

        "tourism": tourism,

        "amenity": amenity,

        "historic": historic,

        "leisure": leisure,

    }


# ============================================================
# 15. DEDUPLICATE OSM RECORDS
# ============================================================

def deduplicate_places(
    places
):

    unique = {}


    for place in places:

        key = (

            place.get(
                "osm_type"
            ),

            place.get(
                "osm_id"
            )

        )


        if key not in unique:

            unique[key] = place


        else:

            existing = unique[key]


            old_category = existing.get(
                "category",
                ""
            )


            new_category = place.get(
                "category",
                ""
            )


            if (

                new_category

                and new_category != old_category

            ):

                categories = set()


                for value in (

                    old_category.split(";")
                    + new_category.split(";")

                ):

                    if value:

                        categories.add(
                            value
                        )


                existing[
                    "category"
                ] = ";".join(
                    sorted(categories)
                )


    return list(
        unique.values()
    )


# ============================================================
# 16. CLIP PLACES TO NAKURU COUNTY
# ============================================================

def clip_places_to_nakuru(
    places,
    nakuru_geometry
):

    print()
    print("=" * 70)
    print("CLIPPING OSM PLACES TO NAKURU COUNTY")
    print("=" * 70)


    if not places:

        print()
        print(
            "No places available to clip."
        )

        return []


    # --------------------------------------------------------
    # Convert places to GeoDataFrame
    # --------------------------------------------------------

    geometries = []


    valid_places = []


    for place in places:

        try:

            point = Point(

                float(
                    place["longitude"]
                ),

                float(
                    place["latitude"]
                )

            )


            geometries.append(
                point
            )


            valid_places.append(
                place
            )


        except (
            TypeError,
            ValueError
        ):

            continue


    gdf = gpd.GeoDataFrame(

        valid_places,

        geometry=geometries,

        crs="EPSG:4326"

    )


    print()
    print(
        f"Places before clipping: "
        f"{len(gdf)}"
    )


    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Only retain points that fall within the actual
    # Nakuru County polygon.
    # --------------------------------------------------------

    mask = gdf.geometry.within(
        nakuru_geometry
    )


    clipped = gdf.loc[
        mask
    ].copy()


    # --------------------------------------------------------
    # Sometimes a point can lie exactly on the boundary.
    #
    # Include boundary points too.
    # --------------------------------------------------------

    boundary_mask = (
        gdf.geometry.touches(
            nakuru_geometry
        )
    )


    clipped = gdf.loc[
        mask | boundary_mask
    ].copy()


    print()
    print(
        f"Places inside Nakuru County: "
        f"{len(clipped)}"
    )


    print()
    print(
        f"Places removed as outside county: "
        f"{len(gdf) - len(clipped)}"
    )


    # --------------------------------------------------------
    # Remove geometry before returning dictionaries
    # --------------------------------------------------------

    clipped = clipped.drop(
        columns=["geometry"]
    )


    return clipped.to_dict(
        orient="records"
    )


# ============================================================
# 17. SAVE CSV
# ============================================================

def save_csv(
    places
):

    website_csv = (

        NAKURU_DATA_DIR
        / "osm_places.csv"

    )


    discovery_csv = (

        DISCOVERY_DIR
        / "osm_places.csv"

    )


    df = pd.DataFrame(
        places
    )


    if not df.empty:

        df = df.sort_values(

            by=[
                "category",
                "name"
            ]

        )


    df.to_csv(

        website_csv,

        index=False,

        encoding="utf-8-sig"

    )


    df.to_csv(

        discovery_csv,

        index=False,

        encoding="utf-8-sig"

    )


    print()
    print(
        "CSV saved:"
    )

    print(
        website_csv
    )


    return website_csv


# ============================================================
# 18. SAVE GEOJSON
# ============================================================

def save_geojson(
    places
):

    features = []


    for place in places:

        properties = {

            "name":
                place.get(
                    "name",
                    ""
                ),

            "category":
                place.get(
                    "category",
                    ""
                ),

            "osm_type":
                place.get(
                    "osm_type",
                    ""
                ),

            "osm_id":
                place.get(
                    "osm_id",
                    ""
                ),

            "address":
                place.get(
                    "address",
                    ""
                ),

            "phone":
                place.get(
                    "phone",
                    ""
                ),

            "email":
                place.get(
                    "email",
                    ""
                ),

            "website":
                place.get(
                    "website",
                    ""
                ),

            "opening_hours":
                place.get(
                    "opening_hours",
                    ""
                ),

            "description":
                place.get(
                    "description",
                    ""
                ),

            "wikipedia":
                place.get(
                    "wikipedia",
                    ""
                ),

            "wikidata":
                place.get(
                    "wikidata",
                    ""
                ),

            "osm_url":
                place.get(
                    "osm_url",
                    ""
                ),

            "operator":
                place.get(
                    "operator",
                    ""
                ),

            "cuisine":
                place.get(
                    "cuisine",
                    ""
                ),

            "religion":
                place.get(
                    "religion",
                    ""
                ),

            "denomination":
                place.get(
                    "denomination",
                    ""
                ),

            "tourism":
                place.get(
                    "tourism",
                    ""
                ),

            "amenity":
                place.get(
                    "amenity",
                    ""
                ),

            "historic":
                place.get(
                    "historic",
                    ""
                ),

            "leisure":
                place.get(
                    "leisure",
                    ""
                ),

        }


        feature = {

            "type": "Feature",

            "geometry": {

                "type": "Point",

                "coordinates": [

                    float(
                        place["longitude"]
                    ),

                    float(
                        place["latitude"]
                    )

                ]

            },

            "properties": properties

        }


        features.append(
            feature
        )


    geojson = {

        "type":
            "FeatureCollection",

        "features":
            features

    }


    # --------------------------------------------------------
    # Website GeoJSON
    # --------------------------------------------------------

    website_geojson = (

        NAKURU_DATA_DIR
        / "osm_places.geojson"

    )


    # --------------------------------------------------------
    # Scraper backup
    # --------------------------------------------------------

    discovery_geojson = (

        DISCOVERY_DIR
        / "osm_places.geojson"

    )


    # --------------------------------------------------------
    # Save website file
    # --------------------------------------------------------

    with open(

        website_geojson,

        "w",

        encoding="utf-8"

    ) as file:

        json.dump(

            geojson,

            file,

            ensure_ascii=False,

            indent=2

        )


    # --------------------------------------------------------
    # Save backup
    # --------------------------------------------------------

    with open(

        discovery_geojson,

        "w",

        encoding="utf-8"

    ) as file:

        json.dump(

            geojson,

            file,

            ensure_ascii=False,

            indent=2

        )


    print()
    print(
        "GeoJSON saved:"
    )

    print(
        website_geojson
    )


    return website_geojson


# ============================================================
# 19. SAVE SUMMARY
# ============================================================

def save_summary(
    places
):

    summary_file = (

        DISCOVERY_DIR
        / "discovery_summary.txt"

    )


    df = pd.DataFrame(
        places
    )


    lines = []


    lines.append(
        "NAKURU COUNTY OPENSTREETMAP DISCOVERY"
    )

    lines.append(
        "=" * 60
    )

    lines.append(
        "Boundary source:"
    )

    lines.append(
        str(BOUNDARY_FILE)
    )

    lines.append("")


    lines.append(
        f"Total unique places: "
        f"{len(places)}"
    )

    lines.append("")


    if not df.empty:

        # ----------------------------------------------------
        # Category counts
        # ----------------------------------------------------

        lines.append(
            "PLACES BY CATEGORY"
        )

        lines.append(
            "-" * 40
        )


        counts = (

            df["category"]

            .fillna("")

            .astype(str)

            .str.split(";")

            .explode()

            .value_counts()

        )


        for category, count in counts.items():

            lines.append(

                f"{category}: {count}"

            )


        lines.append("")


        # ----------------------------------------------------
        # Websites
        # ----------------------------------------------------

        website_count = (

            df["website"]

            .fillna("")

            .astype(str)

            .str.strip()

            .ne("")

            .sum()

        )


        lines.append(

            f"Places with websites: "
            f"{website_count}"

        )


        # ----------------------------------------------------
        # Phone
        # ----------------------------------------------------

        phone_count = (

            df["phone"]

            .fillna("")

            .astype(str)

            .str.strip()

            .ne("")

            .sum()

        )


        lines.append(

            f"Places with phone numbers: "
            f"{phone_count}"

        )


        # ----------------------------------------------------
        # Descriptions
        # ----------------------------------------------------

        description_count = (

            df["description"]

            .fillna("")

            .astype(str)

            .str.strip()

            .ne("")

            .sum()

        )


        lines.append(

            f"Places with descriptions: "
            f"{description_count}"

        )


        # ----------------------------------------------------
        # Addresses
        # ----------------------------------------------------

        address_count = (

            df["address"]

            .fillna("")

            .astype(str)

            .str.strip()

            .ne("")

            .sum()

        )


        lines.append(

            f"Places with addresses: "
            f"{address_count}"

        )


    with open(

        summary_file,

        "w",

        encoding="utf-8"

    ) as file:

        file.write(
            "\n".join(lines)
        )


    print()
    print(
        "Summary saved:"
    )

    print(
        summary_file
    )


# ============================================================
# 20. DISCOVER NAKURU
# ============================================================

def discover_nakuru():

    all_places = []


    category_items = list(
        CATEGORIES.items()
    )


    print()
    print("=" * 70)

    print(
        "NAKURU COUNTY DISCOVERY"
    )

    print(
        "FREE OPENSTREETMAP + OVERPASS"
    )

    print("=" * 70)


    print()
    print(
        f"Categories: "
        f"{len(category_items)}"
    )


    print(
        f"Search bounding box: "
        f"{SEARCH_BBOX}"
    )


    print()
    print(
        "IMPORTANT:"
    )

    print(
        "The search area is deliberately broad."
    )

    print(
        "The actual Nakuru County shapefile will be used"
    )

    print(
        "later to remove places outside the county."
    )


    print()
    print(
        "No API key required."
    )


    print("=" * 70)


    for index, (
        category,
        tags
    ) in enumerate(

        category_items,

        start=1

    ):

        print()

        print(

            f"[{index}/"
            f"{len(category_items)}] "
            f"{category}"

        )


        query = create_overpass_query(
            tags
        )


        elements = run_overpass_query(

            query,

            category

        )


        for element in elements:

            place = extract_place(

                element,

                category

            )


            if place:

                all_places.append(
                    place
                )


        print()

        print(

            "Named places extracted so far: "
            f"{len(all_places)}"

        )


        if index < len(category_items):

            print()

            print(

                f"Waiting "
                f"{REQUEST_DELAY} seconds..."

            )


            time.sleep(
                REQUEST_DELAY
            )


    return all_places


# ============================================================
# 21. MAIN
# ============================================================

def main():

    start_time = time.time()


    # ========================================================
    # LOAD COUNTY BOUNDARY
    # ========================================================

    nakuru_geometry = (
        load_nakuru_boundary()
    )


    # ========================================================
    # DISCOVER OSM PLACES
    # ========================================================

    places = discover_nakuru()


    # ========================================================
    # RAW COUNT
    # ========================================================

    print()
    print("=" * 70)

    print(
        "RAW DISCOVERY COMPLETE"
    )

    print("=" * 70)


    print()

    print(
        f"Raw records discovered: "
        f"{len(places)}"
    )


    # ========================================================
    # DEDUPLICATE
    # ========================================================

    print()
    print("=" * 70)

    print(
        "DEDUPLICATING"
    )

    print("=" * 70)


    unique_places = (
        deduplicate_places(
            places
        )
    )


    print()

    print(
        f"Raw records: "
        f"{len(places)}"
    )


    print(
        f"Unique OSM places: "
        f"{len(unique_places)}"
    )


    # ========================================================
    # CLIP TO ACTUAL NAKURU COUNTY
    # ========================================================

    clipped_places = (
        clip_places_to_nakuru(

            unique_places,

            nakuru_geometry

        )
    )


    # ========================================================
    # SECOND DEDUPLICATION
    # ========================================================
    #
    # This is intentional.
    #
    # We deduplicate once before clipping and once after
    # clipping to make sure the final dataset is clean.
    #
    # ========================================================

    final_places = (
        deduplicate_places(
            clipped_places
        )
    )


    print()
    print("=" * 70)

    print(
        "FINAL DATASET"
    )

    print("=" * 70)


    print()

    print(
        f"Final Nakuru County places: "
        f"{len(final_places)}"
    )


    # ========================================================
    # SAVE CSV
    # ========================================================

    save_csv(
        final_places
    )


    # ========================================================
    # SAVE GEOJSON
    # ========================================================

    save_geojson(
        final_places
    )


    # ========================================================
    # SAVE SUMMARY
    # ========================================================

    save_summary(
        final_places
    )


    # ========================================================
    # FINISH
    # ========================================================

    elapsed = (

        time.time()
        - start_time

    )


    print()
    print("=" * 70)

    print(
        "DISCOVERY COMPLETE"
    )

    print("=" * 70)


    print()

    print(

        f"Final places inside Nakuru County: "
        f"{len(final_places)}"

    )


    print(

        f"Time taken: "
        f"{elapsed / 60:.1f} minutes"

    )


    print()
    print(
        "=========================================================="
    )

    print(
        "WEBSITE DATA"
    )

    print(
        "=========================================================="
    )


    print()

    print(

        NAKURU_DATA_DIR
        / "osm_places.geojson"

    )


    print(

        NAKURU_DATA_DIR
        / "osm_places.csv"

    )


    print()
    print(
        "=========================================================="
    )

    print(
        "SCRAPER DATA"
    )

    print(
        "=========================================================="
    )


    print()

    print(

        DISCOVERY_DIR
        / "osm_places.geojson"

    )


    print(

        DISCOVERY_DIR
        / "osm_places.csv"

    )


    print(

        DISCOVERY_DIR
        / "discovery_summary.txt"

    )


    print()
    print("=" * 70)


# ============================================================
# START PROGRAM
# ============================================================

if __name__ == "__main__":

    main()