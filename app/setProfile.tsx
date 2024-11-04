import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "~/lib/supabase";
import { useAuth } from "~/context/auth";

export default function SetProfile() {
  const { session } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!session) return;
    if (!username.trim()) {
      Alert.alert("Error", "Username is required.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: session.user.id,
        username,
        bio,
      });

      if (error) {
        throw error;
      }

      Alert.alert("Success", "Profile created successfully!");
      router.push("/home"); // Redirect to the home page after setting the profile
    } catch (error) {
      Alert.alert("Error", "An error occurred while saving the profile.");
      console.error("Error saving profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set up your Profile</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder="Enter your username"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={styles.input}
        value={bio}
        onChangeText={setBio}
        placeholder="Tell us about yourself"
        multiline
      />

      <Button
        title={isLoading ? "Saving..." : "Save Profile"}
        onPress={handleSaveProfile}
        disabled={isLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
});
