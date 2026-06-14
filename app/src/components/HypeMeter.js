import React from 'react';
import PropTypes from 'prop-types';
import { View, Text } from 'react-native';

export default function HypeMeter({ current, capacity }) {
    const safeCurrent = Math.max(0, current || 0);
    const percentage = capacity > 0 ? Math.min((safeCurrent / capacity) * 100, 100) : 0;

    return (
        <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, marginBottom: 4 }}>
                🔥 Hype Meter ({Math.round(percentage)}%)
            </Text>

            <View
                style={{
                    height: 8,
                    backgroundColor: '#E5E7EB',
                    borderRadius: 10,
                    overflow: 'hidden',
                }}
            >
                <View
                    style={{
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: '#F97316',
                    }}
                />
            </View>
        </View>
    );
}

HypeMeter.propTypes = {
    current: PropTypes.number,
    capacity: PropTypes.number,
};
