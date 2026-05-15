import { Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../lib/AuthContext';
import DesktopAdmin from './DesktopAdmin';
import MobileAdmin from './MobileAdmin';

export default function AdminDashboard() {
    const { width } = useWindowDimensions();
    const { role } = useAuth();

    if (role !== 'admin') {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Access Denied. Admins only.</Text>
            </View>
        );
    }

    return width >= 1024 ? <DesktopAdmin /> : <MobileAdmin />;
}
