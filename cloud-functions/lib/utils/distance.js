"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistance = calculateDistance;
const geolib_1 = require("geolib");
function calculateDistance(lat1, lon1, lat2, lon2) {
    return (0, geolib_1.getDistance)({
        latitude: lat1,
        longitude: lon1,
    }, {
        latitude: lat2,
        longitude: lon2,
    });
}
//# sourceMappingURL=distance.js.map