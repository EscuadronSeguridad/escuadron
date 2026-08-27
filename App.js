import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function App() {
  const [user, setUser] = useState(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [tab, setTab] = useState('ESCANER');
  const [listas, setListas] = useState({ roja: [], amarilla: [], verde: [] });
  const [guardias, setGuardias] = useState([]);
  const [logs, setLogs] = useState([]);
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [edad, setEdad] = useState('');
  const [resultado, setResultado] = useState(null);
  const [scanMode, setScanMode] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      const l = await AsyncStorage.getItem('listas');
      const g = await AsyncStorage.getItem('guardias');
      const lg = await AsyncStorage.getItem('logs');
      if (l) setListas(JSON.parse(l));
      if (g) setGuardias(JSON.parse(g));
      if (lg) setLogs(JSON.parse(lg));
    })();
  }, []);
  useEffect(() => { AsyncStorage.setItem('listas', JSON.stringify(listas)); }, [listas]);
  useEffect(() => { AsyncStorage.setItem('guardias', JSON.stringify(guardias)); }, [guardias]);
  useEffect(() => { AsyncStorage.setItem('logs', JSON.stringify(logs)); }, [logs]);

  const login = () => {
    if (loginUser === 'escuadron' && loginPass === 'Escuadron2026!') {
      setUser({ rol: 'admin', nombre: 'ESCUADRON' }); return;
    }
    const g = guardias.find(x => x.usuario === loginUser && x.clave === loginPass);
    if (g) {
      const hora = new Date().getHours();
      if (!(g.desde === 0 && g.hasta === 0) && (hora < g.desde || hora >= g.hasta)) {
        Alert.alert('Fuera de horario', `Tu turno es de ${g.desde} a ${g.hasta}hs`); return;
      }
      setUser({ rol: 'garita',...g }); setTab('ESCANER');
    } else Alert.alert('Error', 'Usuario o clave incorrecta');
  };

  const verificar = (dniBuscar) => {
    const d = (dniBuscar || dni).trim(); if (!d) return;
    const enRoja = listas.roja.find(x => x.dni === d);
    const enAmarilla = listas.amarilla.find(x => x.dni === d);
    let r = { dni: d, nombre: nombre || enRoja?.nombre || enAmarilla?.nombre || 'SIN NOMBRE', estado: 'VERDE - PASA', color: '#22c55e' };
    if (enRoja) r = {...r, estado: 'ROJA - NO PASA', color: '#ef4444', motivo: enRoja.motivo };
    else if (enAmarilla) r = {...r, estado: 'AMARILLA - PRECAUCIÓN', color: '#eab308', motivo: enAmarilla.motivo };
    else if (edad && parseInt(edad) < 18) r = {...r, estado: 'MENOR - NO PASA', color: '#ef4444' };
    setResultado(r);
    setLogs(prev => [{...r, fecha: new Date().toLocaleString(), garita: user?.usuario || 'admin' },...prev]);
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanMode(null); let dniExtraido = ''; let nombreExtraido = '';
    if (data.includes('@')) { const p = data.split('@'); if (p.length > 4) { nombreExtraido = `${p[1]} ${p[2]}`.trim(); dniExtraido = p[4].trim(); } }
    else { const m = data.match(/\b\d{7,8}\b/); if (m) dniExtraido = m[0]; }
    if (dniExtraido) { setDni(dniExtraido); if (nombreExtraido) setNombre(nombreExtraido); Alert.alert('DNI Escaneado', `DNI: ${dniExtraido}`, [{ text: 'VERIFICAR', onPress: () => verificar(dniExtraido) }]); }
    else Alert.alert('No se pudo leer', 'Intentá manual');
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.logo}>🛡️ ESCUADRON</Text>
        <TextInput style={styles.input} placeholder="Usuario" value={loginUser} onChangeText={setLoginUser} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Clave" value={loginPass} onChangeText={setLoginPass} secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnT}>ENTRAR</Text></TouchableOpacity>
      </View>
    );
  }

  if (scanMode) {
    if (!permission?.granted) {
      return (<View style={styles.center}><Text>Permiso de cámara</Text><TouchableOpacity style={styles.btn} onPress={requestPermission}><Text style={styles.btnT}>DAR PERMISO</Text></TouchableOpacity><TouchableOpacity style={[styles.btn, { backgroundColor: '#666' }]} onPress={() => setScanMode(null)}><Text style={styles.btnT}>VOLVER</Text></TouchableOpacity></View>);
    }
    return (<View style={{ flex: 1 }}><CameraView style={{ flex: 1 }} onBarcodeScanned={handleBarCodeScanned} barcodeScannerSettings={{ barcodeTypes: ["qr", "pdf417"] }} /><View style={styles.scanOverlay}><TouchableOpacity style={styles.btn} onPress={() => setScanMode(null)}><Text style={styles.btnT}>CANCELAR</Text></TouchableOpacity></View></View>);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerT}>🛡️ {user.rol === 'admin'? 'ESCUADRON CENTRAL' : `GARITA ${user.usuario.toUpperCase()}`}</Text><TouchableOpacity onPress={() => setUser(null)}><Text style={{ color: '#fff' }}>Salir</Text></TouchableOpacity></View>
      {user.rol === 'admin' && (<View style={styles.tabs}>{['ESCANER', 'LISTAS', 'GUARDIAS', 'REPORTES'].map(t => (<TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabA]} onPress={() => setTab(t)}><Text style={[styles.tabT, tab === t && { color: '#fff' }]}>{t}</Text></TouchableOpacity>))}</View>)}
      <ScrollView style={styles.body}>
        {(tab === 'ESCANER' || user.rol === 'garita') && (
          <View>
            <Text style={styles.title}>CONTROL DE INGRESO</Text>
            <View style={styles.row}><TouchableOpacity style={[styles.scanBtn, { backgroundColor: '#2563eb' }]} onPress={() => setScanMode('FISICO')}><Text style={styles.btnT}>📷 FÍSICO</Text></TouchableOpacity><TouchableOpacity style={[styles.scanBtn, { backgroundColor: '#7c3aed' }]} onPress={() => setScanMode('DIGITAL')}><Text style={styles.btnT}>📱 DIGITAL</Text></TouchableOpacity></View>
            <TextInput style={styles.input} placeholder="DNI" value={dni} onChangeText={setDni} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Nombre (opcional)" value={nombre} onChangeText={setNombre} />
            <TextInput style={styles.input} placeholder="Edad (opcional)" value={edad} onChangeText={setEdad} keyboardType="numeric" />
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#000' }]} onPress={() => verificar()}><Text style={styles.btnT}>VERIFICAR</Text></TouchableOpacity>
            {resultado && (<View style={[styles.result, { backgroundColor: resultado.color }]}><Text style={styles.resultT}>{resultado.estado}</Text><Text style={styles.resultD}>DNI: {resultado.dni} - {resultado.nombre}</Text>{resultado.motivo && <Text style={styles.resultD}>{resultado.motivo}</Text>}</View>)}
            {user.rol === 'garita' && (<View style={{ marginTop: 20 }}><Text style={styles.title}>📥 IMPORTAR LISTA PARA TRABAJAR</Text><ImportarBox setListas={setListas} /></View>)}
          </View>
        )}
        {user.rol === 'admin' && tab === 'LISTAS' && <ListasView listas={listas} setListas={setListas} />}
        {user.rol === 'admin' && tab === 'GUARDIAS' && <GuardiasView guardias={guardias} setGuardias={setGuardias} />}
        {user.rol === 'admin' && tab === 'REPORTES' && <ReportesView logs={logs} />}
      </ScrollView>
    </View>
  );
}
function ListasView({ listas, setListas }) {
  const [tipo, setTipo] = useState('roja'); const [dni, setDni] = useState(''); const [nombre, setNombre] = useState(''); const [motivo, setMotivo] = useState('');
  const agregar = () => { if (!dni) return; setListas(prev => ({...prev, [tipo]: [...prev[tipo], { dni, nombre, motivo }] })); setDni(''); setNombre(''); setMotivo(''); };
  const exportar = () => { const txt = `ESCUADRON_LISTA:${JSON.stringify(listas)}`; Alert.alert('COPIÁ ESTO Y ENVIALO POR WHATSAPP', txt); };
  return (<View><Text style={styles.title}>GESTIÓN DE LISTAS</Text><View style={styles.tabs}>{['roja', 'amarilla', 'verde'].map(t => (<TouchableOpacity key={t} style={[styles.tab, tipo === t && styles.tabA]} onPress={() => setTipo(t)}><Text style={[styles.tabT, tipo === t && { color: '#fff' }]}>{t.toUpperCase()}</Text></TouchableOpacity>))}</View><TextInput style={styles.input} placeholder="DNI" value={dni} onChangeText={setDni} keyboardType="numeric" /><TextInput style={styles.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} /><TextInput style={styles.input} placeholder="Motivo" value={motivo} onChangeText={setMotivo} /><TouchableOpacity style={styles.btn} onPress={agregar}><Text style={styles.btnT}>AGREGAR A {tipo.toUpperCase()}</Text></TouchableOpacity>{listas[tipo].map((item, i) => (<View key={i} style={styles.item}><Text>{item.dni} - {item.nombre}</Text><TouchableOpacity onPress={() => setListas(prev => ({...prev, [tipo]: prev[tipo].filter((_, idx) => idx!== i) }))}><Text style={{ color: 'red' }}>X</Text></TouchableOpacity></View>))}<TouchableOpacity style={[styles.btn, { backgroundColor: '#16a34a', marginTop: 20 }]} onPress={exportar}><Text style={styles.btnT}>📤 EXPORTAR LISTA PARA ENVIAR A GARITA</Text></TouchableOpacity></View>);
}
function GuardiasView({ guardias, setGuardias }) {
  const [u, setU] = useState(''); const [c, setC] = useState(''); const [d, setD] = useState(''); const [h, setH] = useState('');
  const agregar = () => { if (!u ||!c) return; setGuardias(prev => [...prev, { usuario: u, clave: c, desde: parseInt(d) || 0, hasta: parseInt(h) || 0 }]); setU(''); setC(''); setD(''); setH(''); };
  return (<View><Text style={styles.title}>GUARDIAS (0 a 0 = 24hs)</Text><TextInput style={styles.input} placeholder="Usuario garita ej: garita1" value={u} onChangeText={setU} autoCapitalize="none" /><TextInput style={styles.input} placeholder="Clave ej: 1234" value={c} onChangeText={setC} /><View style={styles.row}><TextInput style={[styles.input, { flex: 1 }]} placeholder="Desde ej: 22" value={d} onChangeText={setD} keyboardType="numeric" /><TextInput style={[styles.input, { flex: 1 }]} placeholder="Hasta ej: 6" value={h} onChangeText={setH} keyboardType="numeric" /></View><TouchableOpacity style={styles.btn} onPress={agregar}><Text style={styles.btnT}>CREAR GARITA</Text></TouchableOpacity>{guardias.map((g, i) => (<View key={i} style={styles.item}><Text>{g.usuario} - {g.desde} a {g.hasta} {g.desde === 0 && g.hasta === 0? '(24hs)' : ''}</Text><TouchableOpacity onPress={() => setGuardias(prev => prev.filter((_, idx) => idx!== i))}><Text style={{ color: 'red' }}>X</Text></TouchableOpacity></View>))}</View>);
}
function ImportarBox({ setListas }) {
  const [txt, setTxt] = useState('');
  return (<View><TextInput style={[styles.input, { height: 100 }]} placeholder="Pegá acá ESCUADRON_LISTA:..." value={txt} onChangeText={setTxt} multiline /><TouchableOpacity style={styles.btn} onPress={() => { try { const json = txt.replace('ESCUADRON_LISTA:', ''); setListas(JSON.parse(json)); Alert.alert('Lista importada', 'Ya podés trabajar offline'); } catch { Alert.alert('Error', 'Texto inválido'); } }}><Text style={styles.btnT}>IMPORTAR AHORA</Text></TouchableOpacity></View>);
}
function ReportesView({ logs }) { return (<View><Text style={styles.title}>REPORTES</Text>{logs.map((l, i) => (<View key={i} style={[styles.item, { borderLeftWidth: 5, borderLeftColor: l.color }]}><Text style={{ fontWeight: 'bold' }}>{l.estado} - {l.dni}</Text><Text>{l.nombre} - {l.fecha} - {l.garita}</Text></View>))}</View>); }
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' }, center: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#fff' }, logo: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 30 }, input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' }, btn: { backgroundColor: '#111', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }, btnT: { color: '#fff', fontWeight: 'bold' }, header: { backgroundColor: '#111', padding: 15, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, headerT: { color: '#fff', fontWeight: 'bold' }, tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 5 }, tab: { flex: 1, padding: 10, alignItems: 'center', borderRadius: 6 }, tabA: { backgroundColor: '#111' }, tabT: { fontWeight: 'bold', fontSize: 12 }, body: { flex: 1, padding: 15 }, title: { fontWeight: 'bold', fontSize: 16, marginBottom: 15 }, row: { flexDirection: 'row', gap: 10 }, scanBtn: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 }, result: { padding: 20, borderRadius: 12, marginTop: 15 }, resultT: { color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }, resultD: { color: '#fff', textAlign: 'center', marginTop: 5 }, item: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between' }, scanOverlay: { position: 'absolute', bottom: 40, left: 20, right: 20 }
});
