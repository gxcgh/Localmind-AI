import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export default function ResultMap({ locations }) {
    if (!locations || locations.length === 0) return null;

    // Calculate Region to fit all markers
    const latitudes = locations.map(l => l.latitude);
    const longitudes = locations.map(l => l.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) + 0.05; // Add padding
    const lngDelta = (maxLng - minLng) + 0.05;

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                    latitude: midLat,
                    longitude: midLng,
                    latitudeDelta: latDelta,
                    longitudeDelta: lngDelta,
                }}
            >
                {locations.map((loc, index) => (
                    <Marker
                        key={index}
                        coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                        title={loc.name}
                        description={loc.address}
                    />
                ))}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 300,
        width: '100%',
        marginVertical: 10,
        borderRadius: 15,
        overflow: 'hidden',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
});
