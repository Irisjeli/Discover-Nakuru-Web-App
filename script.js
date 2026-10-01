/* ============================================================
   DISCOVER NAKURU | script.js
   ============================================================ */


/* ============================================================
   DATA SETTINGS
   ============================================================ */

const DATA_URL = "data/nakuru/osm_places.geojson";

const BOUNDARY_URL = "data/nakuru/Nakuru_County.geojson";

const STORAGE_KEY = "discoverNakuruUserPlaces";


/* ============================================================
   GLOBAL VARIABLES
   ============================================================ */

let map = null;

let places = [];

let userPlaces = [];

let boundaryGeoJSON = null;

let markerLayer = null;

let boundaryLayer = null;

let selectedCategory = "All";

let locationPickerActive = false;

let selectedLatitude = null;

let selectedLongitude = null;

let selectedImage = "";


/* ============================================================
   CATEGORY ICONS
   ============================================================ */

const CATEGORY_ICONS = {

    "Nature & Wildlife": "🌿",

    "History & Heritage": "🏛️",

    "Geology & Landscape": "🌋",

    "Culture": "🎭",

    "Recreation": "⚽",

    "Scenic Places": "📸",

    "Accommodation": "🏨",

    "Restaurants & Food": "🍴",

    "Shopping": "🛍️",

    "Places of Worship": "⛪"

};


/* ============================================================
   INITIALIZE APPLICATION
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    startApplication
);


async function startApplication() {

    console.log(
        "Starting Discover Nakuru..."
    );


    initializeMap();

    setupCategoryButtons();

    setupSearch();

    setupAddPlaceInterface();

    loadUserPlaces();

    await loadBoundary();

    await loadPlaces();

    displayPlaces();

    updateStatus(
        "Map data loaded successfully.",
        "success"
    );


    console.log(
        "Discover Nakuru loaded successfully."
    );

}


/* ============================================================
   INITIALIZE MAP
   ============================================================ */

function initializeMap() {

    const mapElement =
        document.getElementById("map");


    if (!mapElement) {

        console.error(
            "Map element #map was not found."
        );

        return;

    }


    map = L.map(
        "map",
        {
            zoomControl: true
        }
    ).setView(

        [
            -0.3031,
            36.0800
        ],

        10

    );


    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            maxZoom: 19,

            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'

        }

    ).addTo(map);


    markerLayer =
        L.layerGroup().addTo(map);


    map.on(
        "click",
        handleMapClick
    );


    console.log(
        "Leaflet map initialized."
    );

}


/* ============================================================
   LOAD NAKURU COUNTY BOUNDARY
   ============================================================ */

async function loadBoundary() {

    try {

        const response =
            await fetch(
                BOUNDARY_URL
            );


        if (!response.ok) {

            throw new Error(
                `Boundary request failed: ${response.status}`
            );

        }


        boundaryGeoJSON =
            await response.json();


        if (
            !boundaryGeoJSON ||
            !boundaryGeoJSON.features
        ) {

            throw new Error(
                "Boundary GeoJSON is invalid."
            );

        }


        boundaryLayer =
            L.geoJSON(

                boundaryGeoJSON,

                {

                    style: {

                        color: "#1e4d3a",

                        weight: 2,

                        opacity: 0.9,

                        fillColor: "#1e4d3a",

                        fillOpacity: 0.035

                    }

                }

            ).addTo(map);


        const bounds =
            boundaryLayer.getBounds();


        if (bounds.isValid()) {

            map.fitBounds(
                bounds,
                {
                    padding: [20, 20]
                }
            );

        }


        console.log(
            "Nakuru County boundary loaded."
        );


    } catch (error) {

        console.error(
            "Boundary loading error:",
            error
        );


        updateStatus(
            "Places are loading, but the county boundary could not be loaded.",
            "error"
        );

    }

}


/* ============================================================
   LOAD OSM PLACES
   ============================================================ */

async function loadPlaces() {

    try {

        const response =
            await fetch(
                DATA_URL
            );


        if (!response.ok) {

            throw new Error(
                `Places request failed: ${response.status}`
            );

        }


        const geojson =
            await response.json();


        if (
            !geojson.features ||
            !Array.isArray(
                geojson.features
            )
        ) {

            throw new Error(
                "The places GeoJSON is invalid."
            );

        }


        places =
            geojson.features

                .filter(
                    feature => {

                        return (

                            feature.geometry &&

                            feature.geometry.type ===
                                "Point" &&

                            Array.isArray(
                                feature.geometry.coordinates
                            )

                        );

                    }
                )

                .map(
                    feature => {

                        const properties =
                            feature.properties || {};

                        const coordinates =
                            feature.geometry.coordinates;


                        return {

                            id:
                                properties.osm_id ||
                                `osm-${Date.now()}-${Math.random()}`,

                            name:
                                properties.name ||
                                "Unnamed place",

                            category:
                                getCategory(
                                    properties
                                ),

                            latitude:
                                Number(
                                    coordinates[1]
                                ),

                            longitude:
                                Number(
                                    coordinates[0]
                                ),

                            address:
                                properties.address ||
                                "",

                            phone:
                                properties.phone ||
                                "",

                            email:
                                properties.email ||
                                "",

                            website:
                                properties.website ||
                                "",

                            opening_hours:
                                properties.opening_hours ||
                                "",

                            description:
                                properties.description ||
                                "",

                            wikipedia:
                                properties.wikipedia ||
                                "",

                            wikidata:
                                properties.wikidata ||
                                "",

                            osm_url:
                                properties.osm_url ||
                                "",

                            image:
                                properties.image ||
                                "",

                            source:
                                "OpenStreetMap",

                            userAdded:
                                false

                        };

                    }
                )

                .filter(
                    place => {

                        return (

                            Number.isFinite(
                                place.latitude
                            ) &&

                            Number.isFinite(
                                place.longitude
                            )

                        );

                    }
                );


        console.log(
            `Loaded ${places.length} OSM places.`
        );


    } catch (error) {

        console.error(
            "Places loading error:",
            error
        );


        updateStatus(
            "Could not load osm_places.geojson. Check the data/nakuru folder.",
            "error"
        );

    }

}


/* ============================================================
   CATEGORY MAPPING
   ============================================================ */

function getCategory(
    properties
) {

    if (
        properties.category_label
    ) {

        return normalizeCategory(
            properties.category_label
        );

    }


    const rawCategory =
        String(
            properties.category || ""
        )
            .trim()
            .toUpperCase();


    const name =
        String(
            properties.name || ""
        )
            .trim()
            .toLowerCase();


    /* --------------------------------------------------------
       DIRECT OSM CATEGORIES
       -------------------------------------------------------- */

    if (
        rawCategory ===
            "RELIGIOUS_SITES" ||

        rawCategory ===
            "PLACES_OF_WORSHIP"
    ) {

        return "Places of Worship";

    }


    if (
        rawCategory ===
            "ACCOMMODATION"
    ) {

        return "Accommodation";

    }


    if (
        rawCategory ===
            "FOOD_DRINK"
    ) {

        return "Restaurants & Food";

    }


    if (
        rawCategory ===
            "SHOPPING"
    ) {

        return "Shopping";

    }


    if (
        rawCategory ===
            "NATURE"
    ) {

        return "Nature & Wildlife";

    }


    if (
        rawCategory ===
            "CULTURE_HERITAGE"
    ) {

        return "History & Heritage";

    }


    if (
        rawCategory ===
            "SPORT_RECREATION"
    ) {

        return "Recreation";

    }


    if (
        rawCategory ===
            "TOURISM"
    ) {

        return "Scenic Places";

    }


    /* --------------------------------------------------------
       NAME-BASED CLASSIFICATION
       -------------------------------------------------------- */

    if (

        name.includes("museum") ||

        name.includes("monument") ||

        name.includes("memorial") ||

        name.includes("heritage") ||

        name.includes("fort") ||

        name.includes("castle")

    ) {

        return "History & Heritage";

    }


    if (

        name.includes("crater") ||

        name.includes("volcano") ||

        name.includes("geothermal") ||

        name.includes("hot spring") ||

        name.includes("escarpment") ||

        name.includes("gorge") ||

        name.includes("cliff") ||

        name.includes("cave")

    ) {

        return "Geology & Landscape";

    }


    if (

        name.includes("church") ||

        name.includes("cathedral") ||

        name.includes("mosque") ||

        name.includes("masjid") ||

        name.includes("temple") ||

        name.includes("chapel") ||

        name.includes("synagogue")

    ) {

        return "Places of Worship";

    }


    if (

        name.includes("hotel") ||

        name.includes("lodge") ||

        name.includes("resort") ||

        name.includes("hostel") ||

        name.includes("guest house") ||

        name.includes("guesthouse")

    ) {

        return "Accommodation";

    }


    if (

        name.includes("restaurant") ||

        name.includes("cafe") ||

        name.includes("coffee") ||

        name.includes("kitchen") ||

        name.includes("eatery") ||

        name.includes("diner")

    ) {

        return "Restaurants & Food";

    }


    if (

        name.includes("mall") ||

        name.includes("market") ||

        name.includes("supermarket") ||

        name.includes("shopping")

    ) {

        return "Shopping";

    }


    return "Scenic Places";

}


/* ============================================================
   NORMALIZE CATEGORY
   ============================================================ */

function normalizeCategory(
    category
) {

    const value =
        String(
            category || ""
        ).trim();


    const mapping = {

        "Hotels & Accommodation":
            "Accommodation",

        "Hotels":
            "Accommodation",

        "Hotels & Accommodation":
            "Accommodation",

        "Faith & Worship":
            "Places of Worship",

        "Worship":
            "Places of Worship",

        "Religious Sites":
            "Places of Worship",

        "Places Of Worship":
            "Places of Worship"

    };


    return (
        mapping[value] ||
        value
    );

}


/* ============================================================
   LOAD USER PLACES
   ============================================================ */

function loadUserPlaces() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!saved) {

            userPlaces = [];

            return;

        }


        const parsed =
            JSON.parse(saved);


        if (
            Array.isArray(parsed)
        ) {

            userPlaces =
                parsed
                    .map(
                        place => {

                            return {

                                ...place,

                                category:
                                    normalizeCategory(
                                        place.category
                                    ),

                                userAdded:
                                    true

                            };

                        }
                    )

                    .filter(
                        place => {

                            return (

                                place.name &&

                                Number.isFinite(
                                    Number(
                                        place.latitude
                                    )
                                ) &&

                                Number.isFinite(
                                    Number(
                                        place.longitude
                                    )
                                )

                            );

                        }
                    );

        } else {

            userPlaces = [];

        }


        console.log(
            `Loaded ${userPlaces.length} user places.`
        );


    } catch (error) {

        console.error(
            "Could not load user places:",
            error
        );

        userPlaces = [];

    }

}


/* ============================================================
   SAVE USER PLACES
   ============================================================ */

function saveUserPlaces() {

    try {

        localStorage.setItem(

            STORAGE_KEY,

            JSON.stringify(
                userPlaces
            )

        );


        return true;


    } catch (error) {

        console.error(
            "Could not save user places:",
            error
        );


        alert(
            "The place could not be saved. The browser storage may be full."
        );


        return false;

    }

}


/* ============================================================
   GET ALL PLACES
   ============================================================ */

function getAllPlaces() {

    return [

        ...places,

        ...userPlaces

    ];

}


/* ============================================================
   DISPLAY PLACES
   ============================================================ */

function displayPlaces() {

    if (
        !map ||
        !markerLayer
    ) {

        return;

    }


    markerLayer.clearLayers();


    const searchInput =
        document.getElementById(
            "searchInput"
        );


    const searchTerm =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const allPlaces =
        getAllPlaces();


    const filtered =
        allPlaces.filter(
            place => {

                const categoryMatch =

                    selectedCategory ===
                        "All" ||

                    normalizeCategory(
                        place.category
                    ) ===
                        selectedCategory;


                const searchableText = [

                    place.name,

                    place.category,

                    place.address,

                    place.description

                ]

                    .join(" ")

                    .toLowerCase();


                const searchMatch =

                    !searchTerm ||

                    searchableText.includes(
                        searchTerm
                    );


                return (

                    categoryMatch &&

                    searchMatch

                );

            }
        );


    filtered.forEach(
        place => {

            const marker =
                L.marker(

                    [

                        Number(
                            place.latitude
                        ),

                        Number(
                            place.longitude
                        )

                    ],

                    {

                        icon:
                            createMarkerIcon(
                                place.category,
                                place.userAdded
                            )

                    }

                );


            marker.bindPopup(

                createPopup(
                    place
                ),

                {

                    maxWidth: 340

                }

            );


            markerLayer.addLayer(
                marker
            );

        }
    );


    updatePlaceCount(
        filtered.length
    );

}


/* ============================================================
   CREATE MARKER ICON
   ============================================================ */

function createMarkerIcon(
    category,
    userAdded = false
) {

    const normalized =
        normalizeCategory(
            category
        );


    const icon =
        CATEGORY_ICONS[
            normalized
        ] || "📍";


    const extraClass =
        userAdded
            ? " user-place-marker"
            : "";


    return L.divIcon({

        className:
            "custom-category-marker",

        html:

            `<div class="category-marker${extraClass}">
                <span>${icon}</span>
            </div>`,

        iconSize:
            [40, 40],

        iconAnchor:
            [20, 20],

        popupAnchor:
            [0, -20]

    });

}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* ============================================================
   SAFE URL
   ============================================================ */

function safeURL(
    value
) {

    const url =
        String(
            value || ""
        ).trim();


    if (!url) {
        return "";
    }


    if (
        /^https?:\/\//i.test(
            url
        )
    ) {

        return url;

    }


    return "";
}


/* ============================================================
   WIKIPEDIA URL
   ============================================================ */

function getWikipediaURL(
    wikipedia
) {

    if (!wikipedia) {

        return "";

    }


    let wiki =
        String(
            wikipedia
        ).trim();


    if (
        /^https?:\/\//i.test(
            wiki
        )
    ) {

        return wiki;

    }


    wiki =
        wiki
            .replace(
                /^en:/i,
                ""
            )
            .replace(
                /\s+/g,
                "_"
            );


    return (
        "https://en.wikipedia.org/wiki/" +
        encodeURIComponent(
            wiki
        )
    );

}


/* ============================================================
   CREATE POPUP
   ============================================================ */

function createPopup(
    place
) {

    const category =
        normalizeCategory(
            place.category
        );


    const icon =
        CATEGORY_ICONS[
            category
        ] || "📍";


    let html = "";


    /* --------------------------------------------------------
       IMAGE
       -------------------------------------------------------- */

    if (
        place.image
    ) {

        html += `

            <img
                src="${escapeHTML(place.image)}"
                class="popup-image"
                alt="${escapeHTML(place.name)}"
                onerror="this.style.display='none'"
            >

        `;

    }


    html += `

        <div class="popup-content">

            <div class="popup-category">

                ${icon}

                ${escapeHTML(category)}

            </div>

            <h3>
                ${escapeHTML(place.name)}
            </h3>

    `;


    /* --------------------------------------------------------
       DESCRIPTION
       -------------------------------------------------------- */

    if (
        place.description
    ) {

        html += `

            <p>
                ${escapeHTML(
                    place.description
                )}
            </p>

        `;

    }


    /* --------------------------------------------------------
       ADDRESS
       -------------------------------------------------------- */

    if (
        place.address
    ) {

        html += `

            <p>
                <strong>Location:</strong><br>
                ${escapeHTML(
                    place.address
                )}
            </p>

        `;

    }


    /* --------------------------------------------------------
       PHONE
       -------------------------------------------------------- */

    if (
        place.phone
    ) {

        html += `

            <p>
                <strong>Phone:</strong>
                ${escapeHTML(
                    place.phone
                )}
            </p>

        `;

    }


    /* --------------------------------------------------------
       EMAIL
       -------------------------------------------------------- */

    if (
        place.email
    ) {

        html += `

            <p>
                <strong>Email:</strong>
                ${escapeHTML(
                    place.email
                )}
            </p>

        `;

    }


    /* --------------------------------------------------------
       OPENING HOURS
       -------------------------------------------------------- */

    if (
        place.opening_hours
    ) {

        html += `

            <p>
                <strong>Opening hours:</strong><br>
                ${escapeHTML(
                    place.opening_hours
                )}
            </p>

        `;

    }


    /* --------------------------------------------------------
       WEBSITE
       -------------------------------------------------------- */

    const website =
        safeURL(
            place.website
        );


    if (
        website
    ) {

        html += `

            <p>

                <a
                    href="${escapeHTML(website)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Visit website →
                </a>

            </p>

        `;

    }


    /* --------------------------------------------------------
       WIKIPEDIA
       -------------------------------------------------------- */

    const wikipedia =
        getWikipediaURL(
            place.wikipedia
        );


    if (
        wikipedia
    ) {

        html += `

            <p>

                <a
                    href="${escapeHTML(wikipedia)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Wikipedia →
                </a>

            </p>

        `;

    }


    /* --------------------------------------------------------
       OSM
       -------------------------------------------------------- */

    const osmURL =
        safeURL(
            place.osm_url
        );


    if (
        osmURL
    ) {

        html += `

            <p>

                <a
                    href="${escapeHTML(osmURL)}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View on OpenStreetMap →
                </a>

            </p>

        `;

    }


    /* --------------------------------------------------------
       SOURCE
       -------------------------------------------------------- */

    html += `

            <small>

                Source:
                ${escapeHTML(
                    place.source ||
                    "OpenStreetMap"
                )}

            </small>

        </div>

    `;


    return html;

}


/* ============================================================
   UPDATE PLACE COUNT
   ============================================================ */

function updatePlaceCount(
    count
) {

    const element =
        document.getElementById(
            "placeCount"
        );


    if (
        element
    ) {

        element.textContent =
            count;

    }

}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );


    if (!input) {

        return;

    }


    input.addEventListener(
        "input",
        function() {

            displayPlaces();

        }
    );

}


/* ============================================================
   CATEGORY BUTTONS
   ============================================================ */

function setupCategoryButtons() {

    const buttons =
        document.querySelectorAll(
            ".category-button"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                function() {

                    selectedCategory =
                        this.dataset.category ||
                        "All";


                    buttons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );


                    this.classList.add(
                        "active"
                    );


                    displayPlaces();

                }
            );

        }
    );

}


/* ============================================================
   ADD PLACE INTERFACE
   ============================================================ */

function setupAddPlaceInterface() {

    const addButton =
        document.getElementById(
            "addPlaceButton"
        );


    const closeButton =
        document.getElementById(
            "closeModalButton"
        );


    const cancelButton =
        document.getElementById(
            "cancelFormButton"
        );


    const form =
        document.getElementById(
            "placeForm"
        );


    const photoInput =
        document.getElementById(
            "placePhoto"
        );


    const cancelMapButton =
        document.getElementById(
            "cancelAddButton"
        );


    if (
        addButton
    ) {

        addButton.addEventListener(
            "click",
            openAddPlaceModal
        );

    }


    if (
        closeButton
    ) {

        closeButton.addEventListener(
            "click",
            closeAddPlaceModal
        );

    }


    if (
        cancelButton
    ) {

        cancelButton.addEventListener(
            "click",
            closeAddPlaceModal
        );

    }


    if (
        form
    ) {

        form.addEventListener(
            "submit",
            saveNewPlace
        );

    }


    if (
        photoInput
    ) {

        photoInput.addEventListener(
            "change",
            handlePhotoSelection
        );

    }


    if (
        cancelMapButton
    ) {

        cancelMapButton.addEventListener(
            "click",
            cancelLocationPicker
        );

    }


    const modal =
        document.getElementById(
            "addPlaceModal"
        );


    if (
        modal
    ) {

        modal.addEventListener(
            "click",
            function(event) {

                if (
                    event.target ===
                    modal
                ) {

                    closeAddPlaceModal();

                }

            }
        );

    }


    /* --------------------------------------------------------
       EXPORT
       -------------------------------------------------------- */

    const exportButton =
        document.getElementById(
            "exportButton"
        );


    if (
        exportButton
    ) {

        exportButton.addEventListener(
            "click",
            exportUserPlaces
        );

    }


    /* --------------------------------------------------------
       CLEAR
       -------------------------------------------------------- */

    const clearButton =
        document.getElementById(
            "clearPlacesButton"
        );


    if (
        clearButton
    ) {

        clearButton.addEventListener(
            "click",
            clearUserPlaces
        );

    }

}


/* ============================================================
   OPEN ADD PLACE MODAL
   ============================================================ */

function openAddPlaceModal() {

    const modal =
        document.getElementById(
            "addPlaceModal"
        );


    if (!modal) {

        return;

    }


    locationPickerActive =
        false;


    map.getContainer()
        .style.cursor = "";


    modal.classList.remove(
        "hidden"
    );


    resetLocationFields();

}


/* ============================================================
   CLOSE ADD PLACE MODAL
   ============================================================ */

function closeAddPlaceModal() {

    const modal =
        document.getElementById(
            "addPlaceModal"
        );


    if (
        modal
    ) {

        modal.classList.add(
            "hidden"
        );

    }


    locationPickerActive =
        false;


    if (
        map
    ) {

        map.getContainer()
            .style.cursor = "";

    }


    hideMapInstruction();

}


/* ============================================================
   RESET LOCATION FIELDS
   ============================================================ */

function resetLocationFields() {

    selectedLatitude = null;

    selectedLongitude = null;


    const coordinates =
        document.getElementById(
            "selectedCoordinates"
        );


    if (
        coordinates
    ) {

        coordinates.textContent =
            "Click the map to choose a location.";

    }

}


/* ============================================================
   HANDLE PHOTO
   ============================================================ */

function handlePhotoSelection(
    event
) {

    const file =
        event.target.files[0];


    const previewContainer =
        document.getElementById(
            "photoPreviewContainer"
        );


    const preview =
        document.getElementById(
            "photoPreview"
        );


    if (
        !file
    ) {

        selectedImage = "";


        if (
            previewContainer
        ) {

            previewContainer.classList.add(
                "hidden"
            );

        }


        return;

    }


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Please select an image file."
        );


        event.target.value = "";

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function() {

            selectedImage =
                reader.result;


            if (
                preview
            ) {

                preview.src =
                    selectedImage;

            }


            if (
                previewContainer
            ) {

                previewContainer.classList.remove(
                    "hidden"
                );

            }

        };


    reader.onerror =
        function() {

            selectedImage = "";

            alert(
                "The image could not be read."
            );

        };


    reader.readAsDataURL(
        file
    );

}


/* ============================================================
   ACTIVATE LOCATION PICKER
   ============================================================ */

function activateLocationPicker() {

    if (!map) {

        return;

    }


    locationPickerActive =
        true;


    map.getContainer()
        .style.cursor =
        "crosshair";


    showMapInstruction();


    const modal =
        document.getElementById(
            "addPlaceModal"
        );


    if (
        modal
    ) {

        modal.classList.add(
            "hidden"
        );

    }

}


/* ============================================================
   SHOW MAP INSTRUCTION
   ============================================================ */

function showMapInstruction() {

    const instruction =
        document.getElementById(
            "mapInstruction"
        );


    if (
        instruction
    ) {

        instruction.classList.remove(
            "hidden"
        );

    }

}


/* ============================================================
   HIDE MAP INSTRUCTION
   ============================================================ */

function hideMapInstruction() {

    const instruction =
        document.getElementById(
            "mapInstruction"
        );


    if (
        instruction
    ) {

        instruction.classList.add(
            "hidden"
        );

    }

}


/* ============================================================
   CANCEL LOCATION PICKER
   ============================================================ */

function cancelLocationPicker() {

    locationPickerActive =
        false;


    if (
        map
    ) {

        map.getContainer()
            .style.cursor = "";

    }


    hideMapInstruction();


    openAddPlaceModal();

}


/* ============================================================
   HANDLE MAP CLICK
   ============================================================ */

function handleMapClick(
    event
) {

    if (
        !locationPickerActive
    ) {

        return;

    }


    const latitude =
        event.latlng.lat;


    const longitude =
        event.latlng.lng;


    /* --------------------------------------------------------
       CHECK COUNTY
       -------------------------------------------------------- */

    if (
        !isPointInsideBoundary(
            latitude,
            longitude
        )
    ) {

        alert(
            "Please select a location inside Nakuru County."
        );


        return;

    }


    selectedLatitude =
        latitude;


    selectedLongitude =
        longitude;


    locationPickerActive =
        false;


    map.getContainer()
        .style.cursor = "";


    hideMapInstruction();


    openAddPlaceModal();


    updateSelectedCoordinates();

}


/* ============================================================
   UPDATE COORDINATES DISPLAY
   ============================================================ */

function updateSelectedCoordinates() {

    const element =
        document.getElementById(
            "selectedCoordinates"
        );


    if (
        !element
    ) {

        return;

    }


    if (

        Number.isFinite(
            selectedLatitude
        ) &&

        Number.isFinite(
            selectedLongitude
        )

    ) {

        element.innerHTML = `

            <strong>
                Latitude:
            </strong>
            ${selectedLatitude.toFixed(6)}

            <br>

            <strong>
                Longitude:
            </strong>
            ${selectedLongitude.toFixed(6)}

        `;

    } else {

        element.textContent =
            "Click the map to choose a location.";

    }

}


/* ============================================================
   POINT INSIDE COUNTY
   ============================================================ */

function isPointInsideBoundary(
    latitude,
    longitude
) {

    if (
        !boundaryGeoJSON
    ) {

        /*
         * If the boundary has not loaded, do not block
         * the user. This should normally only happen if
         * the boundary file failed to load.
         */

        return true;

    }


    const point = [

        longitude,

        latitude

    ];


    const features =
        Array.isArray(
            boundaryGeoJSON.features
        )

            ? boundaryGeoJSON.features

            : [];


    for (
        const feature of features
    ) {

        if (
            !feature.geometry
        ) {

            continue;

        }


        const geometry =
            feature.geometry;


        if (
            geometry.type ===
            "Polygon"
        ) {

            if (
                polygonContainsPoint(
                    geometry.coordinates,
                    point
                )
            ) {

                return true;

            }

        }


        if (
            geometry.type ===
            "MultiPolygon"
        ) {

            for (
                const polygon
                of geometry.coordinates
            ) {

                if (
                    polygonContainsPoint(
                        polygon,
                        point
                    )
                ) {

                    return true;

                }

            }

        }

    }


    return false;

}


/* ============================================================
   POINT IN POLYGON
   ============================================================ */

function polygonContainsPoint(
    polygon,
    point
) {

    if (
        !polygon ||
        !polygon.length
    ) {

        return false;

    }


    /*
     * polygon[0] is the exterior ring.
     *
     * Interior rings/holes are not treated as part
     * of the county.
     */

    const outerRing =
        polygon[0];


    if (
        !outerRing ||
        !outerRing.length
    ) {

        return false;

    }


    const x =
        point[0];


    const y =
        point[1];


    let inside = false;


    for (

        let i = 0,
            j = outerRing.length - 1;

        i < outerRing.length;

        j = i++

    ) {

        const xi =
            outerRing[i][0];


        const yi =
            outerRing[i][1];


        const xj =
            outerRing[j][0];


        const yj =
            outerRing[j][1];


        const intersects =

            ((yi > y) !== (yj > y)) &&

            (

                x <

                (

                    (xj - xi) *
                    (y - yi)

                ) /

                (yj - yi) +

                xi

            );


        if (
            intersects
        ) {

            inside =
                !inside;

        }

    }


    return inside;

}


/* ============================================================
   SAVE NEW PLACE
   ============================================================ */

function saveNewPlace(
    event
) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "placeName"
            )
            .value
            .trim();


    const category =
        document
            .getElementById(
                "placeCategory"
            )
            .value;


    const description =
        document
            .getElementById(
                "placeDescription"
            )
            .value
            .trim();


    const address =
        document
            .getElementById(
                "placeAddress"
            )
            .value
            .trim();


    const phone =
        document
            .getElementById(
                "placePhone"
            )
            .value
            .trim();


    const website =
        document
            .getElementById(
                "placeWebsite"
            )
            .value
            .trim();


    const openingHours =
        document
            .getElementById(
                "placeHours"
            )
            .value
            .trim();


    /* --------------------------------------------------------
       VALIDATE NAME
       -------------------------------------------------------- */

    if (
        !name
    ) {

        alert(
            "Please enter the place name."
        );

        return;

    }


    /* --------------------------------------------------------
       VALIDATE CATEGORY
       -------------------------------------------------------- */

    if (
        !category
    ) {

        alert(
            "Please select a category."
        );

        return;

    }


    /* --------------------------------------------------------
       VALIDATE LOCATION
       -------------------------------------------------------- */

    if (

        !Number.isFinite(
            selectedLatitude
        ) ||

        !Number.isFinite(
            selectedLongitude
        )

    ) {

        alert(
            "Please click the map and select a location first."
        );

        return;

    }


    /* --------------------------------------------------------
       COUNTY CHECK
       -------------------------------------------------------- */

    if (
        !isPointInsideBoundary(
            selectedLatitude,
            selectedLongitude
        )
    ) {

        alert(
            "This location is outside Nakuru County."
        );

        return;

    }


    /* --------------------------------------------------------
       DUPLICATE CHECK
       -------------------------------------------------------- */

    const duplicate =
        getAllPlaces().some(
            place => {

                if (
                    !place.name
                ) {

                    return false;

                }


                if (

                    place.name
                        .trim()
                        .toLowerCase() !==

                    name
                        .trim()
                        .toLowerCase()

                ) {

                    return false;

                }


                const distance =
                    calculateDistance(

                        selectedLatitude,

                        selectedLongitude,

                        Number(
                            place.latitude
                        ),

                        Number(
                            place.longitude
                        )

                    );


                return (
                    distance < 100
                );

            }
        );


    if (
        duplicate
    ) {

        alert(
            "A place with this name already exists nearby."
        );

        return;

    }


    /* --------------------------------------------------------
       CREATE PLACE
       -------------------------------------------------------- */

    const newPlace = {

        id:
            `user-${Date.now()}`,

        name:
            name,

        category:
            normalizeCategory(
                category
            ),

        latitude:
            selectedLatitude,

        longitude:
            selectedLongitude,

        address:
            address,

        phone:
            phone,

        email:
            "",

        website:
            website,

        opening_hours:
            openingHours,

        description:
            description,

        wikipedia:
            "",

        wikidata:
            "",

        osm_url:
            "",

        image:
            selectedImage,

        source:
            "Added by Discover Nakuru user",

        userAdded:
            true

    };


    userPlaces.push(
        newPlace
    );


    const saved =
        saveUserPlaces();


    if (
        !saved
    ) {

        return;

    }


    displayPlaces();


    closeAddPlaceModal();


    resetForm();


    /* --------------------------------------------------------
       FLY TO NEW PLACE
       -------------------------------------------------------- */

    map.flyTo(

        [

            selectedLatitude,

            selectedLongitude

        ],

        15,

        {

            duration: 1

        }

    );


    setTimeout(
        function() {

            openPlacePopup(
                newPlace
            );

        },
        900
    );


    updateStatus(
        "Place added successfully. It is currently saved in this browser.",
        "success"
    );

}


/* ============================================================
   RESET FORM
   ============================================================ */

function resetForm() {

    const form =
        document.getElementById(
            "placeForm"
        );


    if (
        form
    ) {

        form.reset();

    }


    selectedImage = "";


    selectedLatitude = null;

    selectedLongitude = null;


    const preview =
        document.getElementById(
            "photoPreviewContainer"
        );


    if (
        preview
    ) {

        preview.classList.add(
            "hidden"
        );

    }


    const previewImage =
        document.getElementById(
            "photoPreview"
        );


    if (
        previewImage
    ) {

        previewImage.src = "";

    }


    resetLocationFields();

}


/* ============================================================
   OPEN POPUP FOR PLACE
   ============================================================ */

function openPlacePopup(
    targetPlace
) {

    let matchingMarker =
        null;


    markerLayer.eachLayer(
        marker => {

            const position =
                marker.getLatLng();


            const latDifference =
                Math.abs(

                    position.lat -

                    Number(
                        targetPlace.latitude
                    )

                );


            const lngDifference =
                Math.abs(

                    position.lng -

                    Number(
                        targetPlace.longitude
                    )

                );


            if (

                latDifference <
                    0.000001 &&

                lngDifference <
                    0.000001

            ) {

                matchingMarker =
                    marker;

            }

        }
    );


    if (
        matchingMarker
    ) {

        matchingMarker.openPopup();

    }

}


/* ============================================================
   CALCULATE DISTANCE
   ============================================================ */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius =
        6371000;


    const degreesToRadians =
        Math.PI / 180;


    const dLat =
        (lat2 - lat1) *
        degreesToRadians;


    const dLon =
        (lon2 - lon1) *
        degreesToRadians;


    const a =

        Math.sin(
            dLat / 2
        ) ** 2 +

        Math.cos(
            lat1 *
            degreesToRadians
        ) *

        Math.cos(
            lat2 *
            degreesToRadians
        ) *

        Math.sin(
            dLon / 2
        ) ** 2;


    const c =
        2 *

        Math.atan2(

            Math.sqrt(a),

            Math.sqrt(
                1 - a
            )

        );


    return (
        earthRadius * c
    );

}


/* ============================================================
   EXPORT USER PLACES
   ============================================================ */

function exportUserPlaces() {

    if (
        userPlaces.length === 0
    ) {

        alert(
            "You have not added any places yet."
        );

        return;

    }


    const features =
        userPlaces.map(
            place => {

                return {

                    type:
                        "Feature",

                    geometry: {

                        type:
                            "Point",

                        coordinates: [

                            Number(
                                place.longitude
                            ),

                            Number(
                                place.latitude
                            )

                        ]

                    },

                    properties: {

                        name:
                            place.name,

                        category_label:
                            place.category,

                        category:
                            place.category,

                        address:
                            place.address,

                        phone:
                            place.phone,

                        website:
                            place.website,

                        opening_hours:
                            place.opening_hours,

                        description:
                            place.description,

                        image:
                            place.image,

                        source:
                            place.source,

                        userAdded:
                            true

                    }

                };

            }
        );


    const geojson = {

        type:
            "FeatureCollection",

        features:
            features

    };


    const json =
        JSON.stringify(
            geojson,
            null,
            2
        );


    const blob =
        new Blob(

            [
                json
            ],

            {
                type:
                    "application/geo+json"
            }

        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "discover-nakuru-user-places.geojson";


    document.body.appendChild(
        link
    );


    link.click();


    document.body.removeChild(
        link
    );


    URL.revokeObjectURL(
        url
    );


    updateStatus(
        "Your user-added places have been exported.",
        "success"
    );

}


/* ============================================================
   CLEAR USER PLACES
   ============================================================ */

function clearUserPlaces() {

    if (
        userPlaces.length === 0
    ) {

        alert(
            "There are no user-added places to clear."
        );

        return;

    }


    const confirmed =
        confirm(

            "Are you sure you want to remove all places you added in this browser?"

        );


    if (
        !confirmed
    ) {

        return;

    }


    userPlaces = [];


    localStorage.removeItem(
        STORAGE_KEY
    );


    displayPlaces();


    updateStatus(
        "Your locally added places have been cleared.",
        "success"
    );

}


/* ============================================================
   UPDATE STATUS MESSAGE
   ============================================================ */

function updateStatus(
    message,
    type = ""
) {

    const element =
        document.getElementById(
            "loadingMessage"
        );


    if (
        !element
    ) {

        return;

    }


    element.textContent =
        message;


    element.classList.remove(
        "success",
        "error"
    );


    if (
        type
    ) {

        element.classList.add(
            type
        );

    }

}


/* ============================================================
   DEBUG INFORMATION
   ============================================================ */

console.log(
    "Discover Nakuru JavaScript loaded."
);