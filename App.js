import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, ScrollView, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [rol, setRol] = useState(null);
  const [user, setUser] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [eventoActivo, setEventoActivo] = useState(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [dniManual, setDniManual] = useState('');
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => { cargar(); }, []);
  const cargar = async () => {
    const e = await AsyncStorage.getItem('ESCUADRON_EVENTOS_V10');
    if (e) setEventos(JSON.parse(e));
    const r = await AsyncStorage.getItem('ESCUADRON_ROL');
    const u = await AsyncStorage.getItem('ESCUADRON_USER');
    if (r) { setRol(r); setUser(u); }
  };
  const guardarEventos = async (ev) => {
    setEventos(ev);
    await AsyncStorage.setItem('ESCUADRON_EVENTOS_V10', JSON.stringify(ev));
  };

  const login = async () => {
    if (loginUser === 'escuadron' && loginPass === 'escuadron2025') {
      setRol('super'); setUser('escuadron');
      await AsyncStorage.setItem('ESCUADRON_ROL', 'super');
      await AsyncStorage.setItem('ESCUADRON_USER', 'escuadron');
    } else if (loginUser.startsWith('admin')) {
      setRol('admin'); setUser(loginUser);
      await AsyncStorage.setItem('ESCUADRON_ROL', 'admin');
      await AsyncStorage.setItem('ESCUADRON_USER', loginUser);
    } else if (loginUser.startsWith('garita')) {
      if (!permission?.granted) await requestPermission();
      setRol('guardia'); setUser(loginUser);
      await AsyncStorage.setItem('ESCUADRON_ROL', 'guardia');
      await AsyncStorage.setItem('ESCUADRON_USER', loginUser);
    } else Alert.alert('Usuario no válido');
  };

  const calcularEdadDesdeBarcode = (data) => {
    const match = data.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})|(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
    if (!match) return null;
    let dia, mes, anio;
    if (match[3]) { dia = parseInt(match[1]); mes = parseInt(match[2]); anio = parseInt(match[3]); }
    else { anio = parseInt(match[4]); mes = parseInt(match[5]); dia = parseInt(match[6]); }
    const hoy = new Date();
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
    return edad;
  };

  const extraerDNI = (data) => {
    const m = data.match(/(\d{7,8})/);
    return m? m[1] : data.replace(/\D/g, '').slice(-8);
  };

  const procesarEscaneo = (dni, edad) => {
    if (!eventoActivo) { Alert.alert('Seleccioná un evento primero'); return; }
    const evs = [...eventos];
    const idx = evs.findIndex(x => x.id === eventoActivo.id);
    const ev = evs[idx];
    const nuevoScan = { dni, edad: edad || 'No disponible', hora: new Date().toLocaleTimeString(), garita: user, resultado: 'VERDE' };
    if (edad!== null && edad!== undefined) {
      if (edad < ev.minEdad || edad > ev.maxEdad) {
        nuevoScan.resultado = 'MENOR/EDAD';
        Vibration.vibrate([500, 200, 500]);
        setLastResult({ dni, edad, estado: `⛔ NO PASA - FUERA DE RANGO (${ev.minEdad} a ${ev.maxEdad})`, color: '#ff0000' });
        ev.scans.unshift(nuevoScan);
        guardarEventos(evs); setEventoActivo(ev); return;
      }
    }
    if (ev.roja.includes(dni)) {
      nuevoScan.resultado = 'ROJA';
      Vibration.vibrate([500, 200, 500]);
      setLastResult({ dni, edad, estado: '⛔ NO PASA - LISTA ROJA', color: '#ff0000' });
    } else {
      Vibration.vibrate(100);
      setLastResult({ dni, edad, estado: '✅ PUEDE PASAR', color: '#00c851' });
    }
    ev.scans.unshift(nuevoScan);
    guardarEventos(evs); setEventoActivo(ev);
  };

  if (!rol) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#111' }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' }}>ESCUADRON SEGURIDAD</Text>
        <Text style={{ color: '#888', textAlign: 'center', marginBottom: 30 }}>Control de Acceso</Text>
        <TextInput placeholder="Usuario: escuadron / admin1 / garita1" placeholderTextColor="#888" style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 10 }} value={loginUser} onChangeText={setLoginUser} />
        <TextInput placeholder="Clave" placeholderTextColor="#888" secureTextEntry style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 10 }} value={loginPass} onChangeText={setLoginPass} />
        <TouchableOpacity onPress={login} style={{ backgroundColor: '#00c851', padding: 15, borderRadius: 10, alignItems: 'center' }}><Text style={{ color: 'white', fontWeight: 'bold' }}>ENTRAR</Text></TouchableOpacity>
      </View>
    );
  }

  if (rol === 'guardia') {
    if (!eventoActivo) {
      return (
        <View style={{ flex: 1, padding: 20, backgroundColor: '#111' }}>
          <Text style={{ color: 'white', fontSize: 20, marginBottom: 20 }}>Hola {user}, elegí evento:</Text>
          {eventos.map(ev => (
            <TouchableOpacity key={ev.id} onPress={() => setEventoActivo(ev)} style={{ backgroundColor: 'white', padding: 20, borderRadius: 10, marginBottom: 10 }}>
              <Text style={{ fontWeight: 'bold' }}>{ev.nombre}</Text>
              <Text>Edad: {ev.minEdad} a {ev.maxEdad} - Rojas: {ev.roja.length}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: '#111' }}>
        {!scanning? (
          <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
            <Text style={{ color: 'white', textAlign: 'center', marginBottom: 10 }}>EVENTO: {eventoActivo.nombre} ({eventoActivo.minEdad}-{eventoActivo.maxEdad})</Text>
            {lastResult && (
              <View style={{ backgroundColor: lastResult.color, padding: 30, borderRadius: 20, marginBottom: 20 }}>
                <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold', textAlign: 'center' }}>{lastResult.estado}</Text>
                <Text style={{ color: 'white', textAlign: 'center', marginTop: 10 }}>DNI: {lastResult.dni} - EDAD: {lastResult.edad}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => setScanning(true)} style={{ backgroundColor: '#00c851', padding: 25, borderRadius: 15, alignItems: 'center', marginBottom: 15 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>📷 ESCANEAR DNI</Text>
            </TouchableOpacity>
            <TextInput placeholder="O escribir DNI manual" keyboardType="numeric" value={dniManual} onChangeText={setDniManual} style={{ backgroundColor: 'white', padding: 15, borderRadius: 10 }} />
            <TouchableOpacity onPress={() => { if (dniManual.length >= 7) { procesarEscaneo(dniManual, null); setDniManual(''); } }} style={{ backgroundColor: 'white', padding: 15, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
              <Text>VERIFICAR MANUAL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEventoActivo(null)} style={{ marginTop: 20 }}><Text style={{ color: '#888', textAlign: 'center' }}>Cambiar evento</Text></TouchableOpacity>
          </View>
        ) : (
          <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ['pdf417', 'qr'] }} onBarcodeScanned={({ data }) => {
            setScanning(false);
            const dni = extraerDNI(data);
            const edad = calcularEdadDesdeBarcode(data);
            procesarEscaneo(dni, edad);
          }} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#111', padding: 20 }}>
      <Text style={{ color: 'white', fontSize: 22, fontWeight: 'bold' }}>PANEL {rol.toUpperCase()} - {user}</Text>
      <TouchableOpacity onPress={async () => {
        const nuevo = { id: Date.now().toString(), nombre: `Evento ${eventos.length + 1}`, minEdad: 18, maxEdad: 60, roja: [], amarilla: [], scans: [] };
        guardarEventos([...eventos, nuevo]);
      }} style={{ backgroundColor: '#00c851', padding: 15, borderRadius: 10, marginTop: 20 }}>
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>+ CREAR NUEVO EVENTO</Text>
      </TouchableOpacity>
      {eventos.map(ev => (
        <View key={ev.id} style={{ backgroundColor: 'white', padding: 15, borderRadius: 10, marginTop: 15 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{ev.nombre} ({ev.minEdad} a {ev.maxEdad})</Text>
          <Text>Total escaneados: {ev.scans.length}</Text>
          <FlatList data={ev.scans.slice(0, 15)} keyExtractor={(_, i) => i.toString()} renderItem={({ item }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, borderBottomWidth: 0.5, paddingBottom: 5 }}>
              <Text>{item.hora} - {item.dni} - {item.edad}a</Text>
              <TouchableOpacity onPress={() => {
                const evs = [...eventos]; const idx = evs.findIndex(x => x.id === ev.id);
                if (!evs[idx].roja.includes(item.dni)) evs[idx].roja.push(item.dni);
                guardarEventos(evs);
                Alert.alert('Pasado a Roja');
              }}><Text style={{ color: 'red', fontWeight: 'bold' }}>+ A ROJA</Text></TouchableOpacity>
            </View>
          )} />
        </View>
      ))}
      <TouchableOpacity onPress={async () => { await AsyncStorage.clear(); setRol(null); }} style={{ marginTop: 30, padding: 15 }}><Text style={{ color: 'red', textAlign: 'center' }}>Cerrar sesión</Text></TouchableOpacity>
    </ScrollView>
  );
}