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
  FlatList,
  Dimensions,
  Vibration,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Mic, Send, X, RefreshCw, Globe, Volume2, StopCircle, Trash2 } from 'lucide-react-native';
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

  // Chat State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');

  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0]);
  const [recording, setRecording] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);

  const cameraRef = useRef(null);
  const flatListRef = useRef(null);

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
        // Clear previous chat when taking new photo to start fresh context
        setMessages([]);
        setInputText('');
      } catch (error) {
        Alert.alert("Error taking picture", error.message);
      }
    }
  }

  function clearImage() {
    setCapturedImage(null);
    setMessages([]);
    setInputText('');
  }

  // --- SUBMISSION LOGIC ---
  function submitQuery(manualText = null, audioUri = null) {
    const textToSend = manualText || inputText;

    // Validation: Must have at least one input (Image OR Text OR Audio)
    if (!capturedImage && !textToSend && !audioUri) {
      Alert.alert("Empty Query", "Please take a photo, speak, or type something.");
      return;
    }

    // Add USER message to chat
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend || (audioUri ? '🎤 Voice Query' : '📷 Image Query'),
      type: 'text'
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    analyze(capturedImage, textToSend, audioUri);
  }

  async function analyze(imageUri, text, audioUri) {
    setAnalyzing(true);
    setIsSpeaking(false);
    Speech.stop();

    try {
      const formData = new FormData();

      if (imageUri) {
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)\$/.exec(filename);
        const type = match ? `image/\${match[1]}` : `image`;
        formData.append('image', { uri: imageUri, name: filename, type });
      }

      if (audioUri) {
        const filename = audioUri.split('/').pop();
        const match = /\.(\w+)\$/.exec(filename);
        const type = match ? `audio/\${match[1]}` : `audio/m4a`;
        formData.append('audio', { uri: audioUri, name: filename, type });
      }

      if (text) {
        formData.append('text', text);
      }

      if (location) {
        formData.append('location', `\${location.coords.latitude},\${location.coords.longitude}`);
      }

      formData.append('language_code', selectedLanguage.code);

      // Send History (Last 5 messages)
      const history = messages.slice(-5).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.text
      }));
      if (history.length > 0) {
        formData.append('history', JSON.stringify(history));
      }

      const res = await axios.post(`\${BACKEND_URL}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data = res.data;
      const reply = data.response;

      // Add AI Response to Chat
      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: reply,
        locations: data.locations,
        showMap: data.show_map && data.locations && data.locations.length > 0
      };

      setMessages(prev => [...prev, aiMsg]);

      setTimeout(() => speak(reply), 500);

    } catch (error) {
      console.error(error);
      const msg = error.response ? `Server Error: \${error.response.status}` : (error.message || "Network Error");

      // Add Error Message to Chat
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        text: "⚠️ " + msg
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setCapturedImage(null);
    setMessages([]);
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
        placeholder={`Ask ${selectedLanguage.label}...`}
        placeholderTextColor="#aaa"
        value={inputText}
        onChangeText={setInputText}
      />

      <TouchableOpacity style={styles.sendButton} onPress={() => submitQuery()}>
        <Send color="white" size={20} />
      </TouchableOpacity>
    </View>
  );

  const renderMessage = ({ item }) => {
    if (item.role === 'user') {
      return (
        <View style={[styles.bubble, styles.userBubble]}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      );
    }

    if (item.role === 'system') {
      return (
        <View style={[styles.bubble, styles.systemBubble]}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.bubble, styles.aiBubble]}>
        <View style={styles.aiHeader}>
          <Image source={require('./assets/icon.png')} style={styles.aiIconSmall} />
          <Text style={styles.aiName}>LocalMind</Text>
          <TouchableOpacity onPress={() => speak(item.text)} style={{ marginLeft: 10 }}>
            <Volume2 color="#00ff9d" size={16} />
          </TouchableOpacity>
        </View>
        <Text style={styles.aiText}>{item.text}</Text>
        {item.showMap && (
          <View style={{ height: 200, marginTop: 10, width: '100%', borderRadius: 10, overflow: 'hidden' }}>
            <ResultMap locations={item.locations} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

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
          // CHAT / ANALYSIS MODE
          <View style={styles.resultContainer}>
            {/* Background Image (Frozen) */}
            <Image source={{ uri: capturedImage }} style={styles.previewImage} blurRadius={10} />

            {/* Chat Interface Overlay */}
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)', 'black']}
              style={styles.chatOverlay}
            >
              {/* Header Actions */}
              <View style={styles.chatHeader}>
                <TouchableOpacity style={styles.headerBtn} onPress={clearImage}>
                  <X color="white" size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Context: Captured Image</Text>
                <TouchableOpacity style={styles.headerBtn} onPress={reset}>
                  <RefreshCw color="white" size={20} />
                </TouchableOpacity>
              </View>

              {/* Messages List */}
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                style={styles.chatList}
                contentContainerStyle={{ paddingBottom: 20 }}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              />

              {/* Loading Indicator */}
              {analyzing && (
                <View style={styles.inlineLoader}>
                  <ActivityIndicator size="small" color="#00ff9d" />
                  <Text style={{ color: '#00ff9d', marginLeft: 8 }}>Thinking...</Text>
                </View>
              )}

              {/* Input Bar Fixed at Bottom */}
              <View style={{ padding: 10 }}>
                {renderInputBar()}
              </View>
            </LinearGradient>
          </View>
        )}
      </KeyboardAvoidingView>
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
    marginBottom: 10, // Adjusted
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    width: '100%',
  },
  micButton: {
    padding: 8,
    marginRight: 5,
  },
  micButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    paddingHorizontal: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#00ff9d',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  chatOverlay: {
    flex: 1,
    paddingTop: 100, // Make room for header
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.3)'
  },
  headerBtn: {
    padding: 10,
  },
  headerTitle: {
    color: '#00ff9d',
    fontWeight: 'bold',
    fontSize: 14,
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 15,
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF', // Blue
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a', // Dark Gray
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#333',
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderColor: '#ff4444',
    borderWidth: 1,
  },
  userText: {
    color: 'white',
    fontSize: 16,
  },
  aiText: {
    color: '#e0e0e0',
    fontSize: 16,
    lineHeight: 22,
  },
  systemText: {
    color: '#ffaaaa',
    fontSize: 14,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiIconSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  aiName: {
    color: '#00ff9d',
    fontWeight: 'bold',
    fontSize: 12,
  },
  inlineLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10
  }
});
