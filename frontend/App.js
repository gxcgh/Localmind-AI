import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
  Vibration,
  Pressable
} from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Camera, MapPin, Mic, Send, X, RefreshCw, Globe, Volume2, StopCircle, Trash2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import ResultMap from './components/ResultMap';

// CONFIG
const BACKEND_URL = 'https://localmiind-ai-backend.onrender.com';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧', voice: 'en-US' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳', voice: 'hi-IN' },
  { code: 'te', label: 'Telugu', flag: '🇮🇳', voice: 'te-IN' },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳', voice: 'ta-IN' },
  { code: 'kn', label: 'Kannada', flag: '🇮🇳', voice: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', flag: '🇮🇳', voice: 'ml-IN' },
  { code: 'bn', label: 'Bengali', flag: '🇮🇳', voice: 'bn-IN' },
  { code: 'mr', label: 'Marathi', flag: '🇮🇳', voice: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', flag: '🇮🇳', voice: 'gu-IN' },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [response, setResponse] = useState(null);
  const [inputText, setInputText] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [recording, setRecording] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);
  const [resultLocations, setResultLocations] = useState([]);
  const [showMap, setShowMap] = useState(false);

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Location Permission
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Alert.alert('Permission to access location was denied');
      }
      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);

      // Audio Permission
      const audioStatus = await Audio.requestPermissionsAsync();
      setAudioPermission(audioStatus.status === 'granted');
    })();
  }, []);

  if (!permission) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#00ff9d" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission needed.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.grantButton}><Text>Grant</Text></TouchableOpacity>
      </View>
    );
  }

  // --- AUDIO RECORDING (MANUAL TOGGLE) ---
  async function toggleRecording() {
    if (recording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  }

  async function startRecording() {
    try {
      if (!audioPermission) {
        Alert.alert("Permission Req", "Microphone access needed.");
        return;
      }
      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      Vibration.vibrate(50);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecordingAndSend() {
    if (!recording) return;

    try {
      setRecording(null); // Optimistic UI update
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      Vibration.vibrate(50);

      // Immediate Send
      submitQuery(null, uri);
    } catch (e) {
      console.error("Stop recording failed", e);
    }
  }

  // --- TEXT TO SPEECH ---
  const speak = (text) => {
    if (!text) return;
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    Speech.speak(text, {
      language: selectedLanguage.voice || 'en-US',
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // --- CAMERA ---
  async function captureImage() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.5,
          base64: false,
        });
        setCapturedImage(photo.uri);
        // Do NOT auto-analyze. Wait for user input.
      } catch (error) {
        Alert.alert("Error taking picture", error.message);
      }
    }
  }

  function clearImage() {
    setCapturedImage(null);
    setResponse(null);
    setResultLocations([]);
    setShowMap(false);
  }

  // --- SUBMISSION LOGIC ---
  function submitQuery(manualText = null, audioUri = null) {
    const textToSend = manualText || inputText;

    // Validation: Must have at least one input (Image OR Text OR Audio)
    if (!capturedImage && !textToSend && !audioUri) {
      Alert.alert("Empty Query", "Please take a photo, speak, or type something.");
      return;
    }

    analyze(capturedImage, textToSend, audioUri);
    setInputText(''); // Clear text input after send
  }

  async function analyze(imageUri, text, audioUri) {
    setAnalyzing(true);
    setResponse(null);
    setResultLocations([]);
    setShowMap(false);
    setIsSpeaking(false);
    Speech.stop();

    try {
      const formData = new FormData();

      if (imageUri) {
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        // @ts-ignore
        formData.append('image', { uri: imageUri, name: filename, type });
      }

      if (audioUri) {
        const filename = audioUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `audio/${match[1]}` : `audio/m4a`;
        // @ts-ignore
        formData.append('audio', { uri: audioUri, name: filename, type });
      }

      if (text) {
        formData.append('text', text);
      }

      if (location) {
        formData.append('location', `${location.coords.latitude},${location.coords.longitude}`);
      }

      formData.append('language_code', selectedLanguage.code);

      const res = await axios.post(`${BACKEND_URL}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data = res.data;
      const reply = data.response;

      setResponse(reply);
      setResultLocations(data.locations || []);

      // Only show map if backend explicitly requested it AND we have locations
      if (data.show_map && data.locations && data.locations.length > 0) {
        setShowMap(true);
      } else {
        setShowMap(false);
      }

      setTimeout(() => speak(reply), 500);

    } catch (error) {
      console.error(error);
      const msg = error.response ? `Server Error: ${error.response.status}` : (error.message || "Network Error");
      Alert.alert("Analysis Failed", msg);
      setAnalyzing(false);
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setCapturedImage(null);
    setResponse(null);
    setResultLocations([]);
    setShowMap(false);
    setInputText('');
    setRecording(null);
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
  }

  // RENDER HELPERS
  const renderInputBar = () => (
    <View style={styles.inputContainer}>
      {/* Mic Button */}
      <TouchableOpacity
        style={[styles.micButton, recording && styles.micButtonActive]}
        onPress={toggleRecording}
      >
        {recording ? <StopCircle color="red" size={24} /> : <Mic color="white" size={22} />}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder={`Ask ${selectedLanguage.label} (Text/Mic)...`}
        placeholderTextColor="#aaa"
        value={inputText}
        onChangeText={setInputText}
      />

      <TouchableOpacity style={styles.sendButton} onPress={() => submitQuery()}>
        <Send color="white" size={20} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* HEADER (Language) */}
      <View style={styles.absoluteHeader}>
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={styles.topGradient}
        >
          <View style={styles.languageContainer}>
            <Globe color="#00ff9d" size={20} style={{ marginRight: 8 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageChip,
                    selectedLanguage.code === lang.code && styles.languageChipSelected
                  ]}
                  onPress={() => setSelectedLanguage(lang)}
                >
                  <Text style={[
                    styles.languageText,
                    selectedLanguage.code === lang.code && styles.languageTextSelected
                  ]}>
                    {lang.flag} {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </LinearGradient>
      </View>

      {/* MAIN CONTENT AREA */}
      {!capturedImage ? (
        // LIVE CAMERA MODE
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.overlay}>
            {renderInputBar()}

            <View style={styles.controls}>
              <TouchableOpacity style={styles.captureButton} onPress={captureImage}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <Text style={styles.hintText}>Tap circle to freeze image</Text>
            </View>
          </View>
        </CameraView>
      ) : (
        // IMAGE PREVIEW / REVIEW MODE
        <View style={styles.resultContainer}>
          <Image source={{ uri: capturedImage }} style={styles.previewImage} blurRadius={analyzing ? 15 : 0} />

          {/* Overlay for frozen image */}
          {!response && !analyzing && (
            <View style={styles.overlay}>
              {/* Close Image Button */}
              <TouchableOpacity style={styles.discardButton} onPress={clearImage}>
                <X color="white" size={24} />
              </TouchableOpacity>

              {/* Reuse Input Bar */}
              {renderInputBar()}

              <View style={styles.controls}>
                <Text style={styles.hintText}>Image captured. Ask a question now!</Text>
              </View>
            </View>
          )}

          {analyzing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#00ff9d" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          )}

          {/* RESPONSE CARD */}
          {response && !analyzing && (
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)', 'black']}
              style={styles.responseWrapper}
            >
              <View style={styles.responseCard}>
                <View style={styles.responseHeaderContainer}>
                  <Image source={require('./assets/icon.png')} style={styles.aiIcon} />
                  <Text style={styles.responseHeader}>LocalMind AI</Text>
                  <View style={{ flex: 1 }} />

                  <TouchableOpacity onPress={() => speak(response)} style={styles.speakButton}>
                    {isSpeaking ? <StopCircle color="#ff4444" size={24} /> : <Volume2 color="#00ff9d" size={24} />}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={reset} style={styles.closeIcon}>
                    <RefreshCw color="#ccc" size={24} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.responseBox}>
                  <Text style={styles.responseText}>{response}</Text>

                  {/* Render Map if requested */}
                  {showMap && resultLocations.length > 0 && (
                    <ResultMap locations={resultLocations} />
                  )}
                </ScrollView>
              </View>
            </LinearGradient>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: 'white',
    marginBottom: 20
  },
  grantButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5
  },
  camera: {
    flex: 1,
  },
  topGradient: {
    height: 120,
    paddingTop: 50,
    paddingHorizontal: 15,
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  languageChipSelected: {
    backgroundColor: 'rgba(0, 255, 157, 0.2)',
    borderColor: '#00ff9d',
  },
  languageText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  languageTextSelected: {
    color: '#00ff9d',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    padding: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  micButton: {
    padding: 10,
    marginRight: 5,
  },
  micButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 30, // Circle
    padding: 12,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingRight: 10,
  },
  sendButton: {
    padding: 8,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    elevation: 8,
  },
  hintText: {
    color: '#ccc',
    fontSize: 12,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    position: 'absolute',
  },
  discardButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: '#00ff9d',
    marginTop: 15,
    fontSize: 18,
    fontWeight: '600',
  },
  responseWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  responseCard: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 20,
    height: '60%',
    elevation: 20,
    borderTopWidth: 1,
    borderColor: '#333',
  },
  responseHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  aiIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
  },
  responseHeader: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  speakButton: {
    padding: 5,
    marginRight: 15,
  },
  closeIcon: {
    padding: 5,
  },
  responseBox: {
    flex: 1,
  },
  responseText: {
    color: '#e0e0e0',
    fontSize: 17,
    lineHeight: 26,
  },
});
