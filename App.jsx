import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import BleManager from 'react-native-ble-manager';

import * as echarts from 'echarts/core';
import {LineChart} from 'echarts/charts';
import {GridComponent} from 'echarts/components';
import {SVGRenderer, SvgChart} from '@wuba/react-native-echarts';

echarts.use([SkiaRenderer, LineChart, GridComponent]);

const bleManagerEmitter = new NativeEventEmitter(NativeModules.BleManager);

const App = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState({});
  const [connectedDeviceId, setConnectedDeviceId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showRadar, setShowRadar] = useState(false);

  const svgRef = useRef(null);

  const option = {
    radar: {
      indicator: [
        {name: 'Sales', max: 6500},
        {name: 'Administration', max: 16000},
        {name: 'Information Tech', max: 30000},
        {name: 'Customer Support', max: 38000},
        {name: 'Development', max: 52000},
        {name: 'Marketing', max: 25000},
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [4300, 10000, 28000, 35000, 50000, 19000],
            name: 'Allocated budget',
          },
          {
            value: [5000, 14000, 28000, 31000, 42000, 21000],
            name: 'Actual spending',
          },
        ],
      },
    ],
  };

  const chart = echarts.init(svgRef.current, 'light', {
    renderer: 'svg',
    width: 400,
    height: 400,
  });
  chart.setOption(option);

  useEffect(() => {
    return () => chart?.dispose();
  }, []);

  const checkPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        if (!granted) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          return result === 'granted';
        }
        return true;
      } catch (err) {
        console.error('Permission check error:', err);
        return false;
      }
    }
    return true;
  };

  useEffect(() => {
    // Verify module is Ok
    if (!NativeModules.BleManager) {
      console.error('BleManager module not found');
      setStatusMessage('Bluetooth module not available');
      return;
    }

    // Test bluetooth
    BleManager.enableBluetooth()
      .then(() => {
        console.log('Bluetooth is enabled');
        BleManager.start({showAlert: false})
          .then(() => console.log('BleManager initialized'))
          .catch(err => console.error('BleManager init error:', err));
      })
      .catch(error => {
        console.error('Enable bluetooth error:', error);
        setStatusMessage('Please enable Bluetooth');
      });

    BleManager.start({showAlert: false});

    const listeners = [
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerConnectPeripheral',
        handleConnectPeripheral,
      ),
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectPeripheral,
      ),
    ];

    return () => {
      listeners.forEach(listener => listener.remove());
      if (connectedDeviceId) {
        BleManager.disconnect(connectedDeviceId).catch(console.error);
      }
    };
  }, [connectedDeviceId]);

  const handleDiscoverPeripheral = peripheral => {
    if (!peripheral.name && !peripheral.advertising?.localName) {
      console.log('Device noname:', peripheral);
      return;
    }

    const deviceName =
      peripheral.name || peripheral.advertising?.localName || 'Unknown Device';

    setPeripherals(prev => ({
      ...prev,
      [peripheral.id]: {...peripheral, name: deviceName},
    }));
  };

  const handleConnectPeripheral = peripheral => {
    setConnectedDeviceId(peripheral.id);
    setStatusMessage(`Connected to ${peripheral.name || peripheral.id}`);
  };

  const handleDisconnectPeripheral = peripheral => {
    setConnectedDeviceId(null);
    setStatusMessage(`Disconnected from ${peripheral.id}`);
  };

  const startScan = async () => {
    if (isScanning) {
      return;
    }

    try {
      // Verify Bluetooth ON
      const isEnabled = await BleManager.checkState();
      if (isEnabled !== 'on') {
        setStatusMessage('Please enable Bluetooth');
        return;
      }

      // 2. Verify permissions
      const hasPermission = await checkPermissions();
      if (!hasPermission) {
        setStatusMessage('Location permission required');
        return;
      }

      // 3. Config scan
      setIsScanning(true);
      setPeripherals({});
      setStatusMessage('Scanning for devices...');

      // 4. Begin scan (15 segs)
      await BleManager.scan([], 15, true, {scanMode: 2});

      // 5. Stop scan after timeout
      setTimeout(() => {
        setIsScanning(false);
        setStatusMessage(
          peripherals.length > 0 ? 'Scan completed' : 'No devices found',
        );
      }, 15_000);
    } catch (err) {
      console.error('Scan error:', err);
      setIsScanning(false);
      setStatusMessage(`Scan failed: ${err.message}`);
    }
  };

  const connect = async peripheral => {
    try {
      setStatusMessage(`Connecting to ${peripheral.name || peripheral.id}...`);
      await BleManager.connect(peripheral.id);
    } catch (error) {
      console.error('Connection error:', error);
      setStatusMessage(`Connection failed: ${error.message}`);
    }
  };

  const disconnect = async peripheralId => {
    try {
      setStatusMessage('Disconnecting...');
      await BleManager.disconnect(peripheralId);
    } catch (error) {
      console.error('Disconnection error:', error);
      setStatusMessage(`Disconnection failed: ${error.message}`);
    }
  };

  const renderItem = ({item}) => {
    const peripheral = item[1];
    return (
      <View style={styles.deviceItem}>
        <Text style={styles.deviceName}>
          {peripheral.name || 'Unknown Device'}
        </Text>
        <Text style={styles.deviceId}>{peripheral.id}</Text>
        {connectedDeviceId === peripheral.id ? (
          <Button
            title="Disconnect"
            onPress={() => disconnect(peripheral.id)}
          />
        ) : (
          <Button title="Connect" onPress={() => connect(peripheral)} />
        )}
      </View>
    );
  };

  const changeShowRadar = () => {
    setShowRadar(!showRadar);
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      {isScanning ? (
        <>
          <ActivityIndicator size="large" />
          <Text>Scanning for devices...</Text>
        </>
      ) : (
        <Text>No devices found. Press "Scan Devices" to search.</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bluetooth Devices</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Scan Devices"
          onPress={startScan}
          disabled={isScanning}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Show Radar Graph"
          onPress={changeShowRadar}
          disabled={isScanning}
        />
      </View>
      {statusMessage ? (
        <Text style={styles.status}>{statusMessage}</Text>
      ) : null}
      {showRadar ? (
        <>
          <Text style={styles.status}>Radar Graph Placeholder</Text>
          <SvgChart ref={svgRef} />
        </>
      ) : (
        <FlatList
          style={styles.list}
          data={Object.entries(peripherals)}
          renderItem={renderItem}
          keyExtractor={item => item[0]}
          ListEmptyComponent={renderEmptyComponent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  status: {
    color: '#555',
    textAlign: 'center',
    marginBottom: 10,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  deviceId: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default App;
