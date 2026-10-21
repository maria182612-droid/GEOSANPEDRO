// ======================================================
// CONFIGURACIÓN DEL MAPA
// ======================================================

var map = L.map('map', {
    preferCanvas: true,
    zoomControl: true,
    attributionControl: true,
    maxZoom: 20,
    minZoom: 2
}).setView([6.24, -75.58], 13);

L.control.scale({
    position: 'bottomright',
    imperial: false
}).addTo(map);

var mapBounds = L.latLngBounds([
    [6.08, -75.72],
    [6.38, -75.46]
]);

// ======================================================
// MAPA BASE - ESRI WORLD IMAGERY
// ======================================================

var Esri_WorldImagery = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, ' +
            'AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, ' +
            'and the GIS User Community'
    }
);

var CartoDB_Voyager = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd'
    }
);

// Mostrar el mapa base al iniciar
Esri_WorldImagery.addTo(map);


// ======================================================
// GRUPO GENERAL DE CAPAS
// ======================================================

var capas = {};
var capasDeUsuario = L.featureGroup().addTo(map);


// ======================================================
// FUNCIÓN PARA MOSTRAR LOS ATRIBUTOS DEL SHAPEFILE
// ======================================================

function mostrarAtributos(feature, layer) {

    var contenido = document.createElement('pre');

    contenido.textContent =
        Object.entries(feature.properties || {})
            .map(function ([campo, valor]) {
                return campo + ': ' + valor;
            })
            .join('\n');

    layer.bindPopup(contenido);
}


// ======================================================
// CARGAR SHAPEFILE .ZIP
// ======================================================

function cargarShapefile(ruta, nombre, opciones) {

    opciones = opciones || {};

    var grupo = new L.Shapefile(ruta, {
        onEachFeature: mostrarAtributos,
        style: opciones.style || {
            color: '#0f766e',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.18
        }
    });

    capas[nombre] = grupo;

    if (opciones.visible !== false) {
        grupo.addTo(map);
    }

    return grupo;
}


// ======================================================
// CARGA DE CAPAS VECTORIALES DE LA CARPETA date
// ======================================================

// Coloca aquí los nombres de tus archivos ZIP.
//
// Ejemplo:
//
// var expansion = cargarShapefile(
//     'data/AREA_EXPANSION_ROBLEDO_43262.zip',
//     'Área de expansión'
// );

cargarShapefile(
    'date/Limites_San_pedro.zip',
    'Límites San Pedro',
    {
        style: {
            color: '#0f766e',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.12
        }
    }
);

cargarShapefile(
    'date/Limite_urbano.zip',
    'Límite urbano',
    {
        style: {
            color: '#7c3aed',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.22
        }
    }
);

cargarShapefile(
    'date/Manchas_de_inundacion.zip',
    'Zonas de inundación',
    {
        style: {
            color: '#1d4ed8',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.38
        }
    }
);

cargarShapefile(
    'date/Pomca.zip',
    'POMCA',
    {
        style: {
            color: '#dc2626',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.18
        }
    }
);

cargarShapefile(
    'date/Modelo de Riesgo.zip',
    'Modelo de riesgo',
    {
        style: {
            color: '#b45309',
            weight: 2,
            opacity: 0.9,
            fillOpacity: 0.25
        }
    }
);


// ======================================================
// FUNCIÓN PARA CARGAR GEOTIFF
// ======================================================

var limitesRasters = L.latLngBounds();


function cargarGeoTiff(ruta, nombre, opciones) {

    opciones = opciones || {};

    var grupo = L.layerGroup();

    capas[nombre] = grupo;

    fetch(ruta)

        .then(function (response) {

            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }

            return response.arrayBuffer();
        })

        .then(function (buffer) {

            return parseGeoraster(buffer, {
                readOnDemand: true
            });

        })

        .then(function (georaster) {

            var hasColorBands = georaster.numberOfRasters >= 3;

            var capa = new GeoRasterLayer({
                georaster: georaster,
                resolution: 256,
                opacity: opciones.opacity !== undefined ? opciones.opacity : 0.9,
                pixelValuesToColorFn: function (values) {
                    if (values.some(function (value) {
                        return value == null || Number.isNaN(value);
                    })) {
                        return null;
                    }

                    if (values.length > 3 && values[3] === 0) {
                        return null;
                    }

                    if (!hasColorBands) {
                        var value = values[0];
                        var alpha = values.length > 1 ? values[1] : 255;

                        if (opciones.fondoNegro && value <= 5) {
                            return null;
                        }

                        if (values.length > 1 && alpha === 0) {
                            return null;
                        }

                        return 'rgba(15, 118, 110, ' + (value / 65535) + ')';
                    }

                    var r = values[0];
                    var g = values[1];
                    var b = values[2];

                    if (opciones.ycbcr) {
                        var y = values[0];
                        var cb = values[1] - 128;
                        var cr = values[2] - 128;

                        r = Math.round(y + 1.402 * cr);
                        g = Math.round(y - 0.34414 * cb - 0.71414 * cr);
                        b = Math.round(y + 1.772 * cb);
                    }

                    if (opciones.fondoNegro && r <= 5 && g <= 5 && b <= 5) {
                        return null;
                    }

                    if (values.length > 3) {
                        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + (values[3] / 255) + ')';
                    }

                    return 'rgb(' + r + ', ' + g + ', ' + b + ')';
                }
            });

            grupo.addLayer(capa);
            limitesRasters.extend(capa.getBounds());

            if (opciones.visible !== false) {
                grupo.addTo(map);
            }
        })

        .catch(function (error) {
            console.error('No se pudo cargar ' + ruta + ':', error);
        });

    return grupo;
}


// ======================================================
// CARGAR LOS ARCHIVOS TIF DE LA CARPETA date
// ======================================================

cargarGeoTiff(
    'date/DEM_San_pedro_SRTM30m.tif',
    'Modelo Digital de Elevación',
    {
        opacity: 0.8,
        visible: false
    }
);

cargarGeoTiff(
    'date/Pendientes_Clase_IGAC_San_pedro.tif',
    'Pendientes IGAC',
    {
        opacity: 0.8,
        visible: false
    }
);


// ======================================================
// CONTROL DE CAPAS
// ======================================================

var basemaps = {
    'Imágenes Esri': Esri_WorldImagery,
    'Mapa CartoDB': CartoDB_Voyager
};

var overlays = Object.assign({}, capas, {
    'Elementos creados': capasDeUsuario
});

var layerControl = L.control.layers(
    basemaps,
    overlays,
    {
        collapsed: false,
        position: 'topright'
    }
).addTo(map);


// ======================================================
// HERRAMIENTAS DE DIBUJO Y MEDICCIÓN
// ======================================================

var drawControl = new L.Control.Draw({
    position: 'topleft',
    draw: {
        marker: {
            title: 'Crear punto',
            icon: new L.DivIcon({
                className: 'custom-marker',
                html: '<span></span>',
                iconSize: [16, 16]
            })
        },
        polygon: {
            title: 'Crear polígono',
            allowIntersection: false,
            showArea: true,
            metric: true,
            shapeOptions: {
                color: '#0f766e',
                weight: 2,
                opacity: 0.95,
                fillColor: '#5eead4',
                fillOpacity: 0.25
            }
        },
        polyline: {
            title: 'Medir distancia',
            metric: true,
            shapeOptions: {
                color: '#f59e0b',
                weight: 4,
                opacity: 0.9
            }
        },
        circle: false,
        rectangle: false,
        circlemarker: false,
        edit: {
            featureGroup: capasDeUsuario,
            remove: true
        },
        delete: false
    }
}).addTo(map);

function calcularDistancia(latlngs) {
    var distancia = 0;

    for (var i = 1; i < latlngs.length; i++) {
        distancia += map.distance(latlngs[i - 1], latlngs[i]);
    }

    return distancia;
}

function calcularArea(latlngs) {
    if (!latlngs || latlngs.length < 3) {
        return 0;
    }

    var area = 0;

    for (var i = 0; i < latlngs.length; i++) {
        var puntoActual = latlngs[i];
        var puntoSiguiente = latlngs[(i + 1) % latlngs.length];
        area += puntoActual.lng * puntoSiguiente.lat - puntoSiguiente.lng * puntoActual.lat;
    }

    return Math.abs(area) * 6371000 * 6371000 * Math.PI / 180 / 180 / 2;
}

map.on(L.Draw.Event.CREATED, function (event) {
    var layer = event.layer;

    capasDeUsuario.addLayer(layer);

    if (layer instanceof L.Marker) {
        layer.bindPopup('Punto creado');
    }

    if (layer instanceof L.Polygon) {
        var area = calcularArea(layer.getLatLngs()[0]);
        layer.bindPopup('Área: ' + area.toFixed(2) + ' m²');
    }

    if (layer instanceof L.Polyline) {
        var distancia = calcularDistancia(layer.getLatLngs());
        layer.bindPopup('Distancia: ' + distancia.toFixed(2) + ' m');
    }
});

map.on(L.Draw.Event.EDITED, function () {
    setStatus('Las geometrías fueron actualizadas.');
});

map.on(L.Draw.Event.DELETED, function () {
    setStatus('La geometría fue eliminada.');
});

function setStatus(mensaje) {
    var status = document.querySelector('.status-control');
    if (status) {
        status.textContent = mensaje;
        return;
    }

    status = L.DomUtil.create('div', 'status-control');
    status.textContent = mensaje;
    status.setAttribute('role', 'status');
    map.getContainer().appendChild(status);
}

setStatus('Herramientas activas: medición, puntos y polígonos.');


// ======================================================
// CONTROL DE COORDENADAS
// ======================================================

var coordsControl = L.control({
    position: 'bottomleft'
});


coordsControl.onAdd = function (map) {

    this._div = L.DomUtil.create(
        'div',
        'leaflet-bar coordenadas-control'
    );

    this._div.innerHTML =
        'Lat: -- | Lon: --';

    return this._div;
};


coordsControl.addTo(map);


// ======================================================
// ACTUALIZAR COORDENADAS AL MOVER EL CURSOR
// ======================================================

map.on('mousemove', function (e) {

    coordsControl._div.innerHTML =
        'Lat: ' +
        e.latlng.lat.toFixed(6) +
        ' | Lon: ' +
        e.latlng.lng.toFixed(6);

});