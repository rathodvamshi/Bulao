import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Image } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  // Animation values for B logo
  const bFillOpacity = useRef(new Animated.Value(0)).current;
  
  // Animation values for individual letters
  const uOpacity = useRef(new Animated.Value(0)).current;
  const uTranslateY = useRef(new Animated.Value(20)).current;
  const lOpacity = useRef(new Animated.Value(0)).current;
  const lTranslateY = useRef(new Animated.Value(20)).current;
  const aOpacity = useRef(new Animated.Value(0)).current;
  const aTranslateY = useRef(new Animated.Value(20)).current;
  const oOpacity = useRef(new Animated.Value(0)).current;
  const oTranslateY = useRef(new Animated.Value(20)).current;
  
  // Underline that grows with letters
  const underlineWidth = useRef(new Animated.Value(0)).current;
  
  // Progress and screen elements
  const progressWidth = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const bgImageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Helper function to animate a letter - slightly faster
    const animateLetter = (
      opacity: Animated.Value, 
      translateY: Animated.Value,
      delay: number
    ) => {
      return Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          delay,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 55,
          delay,
          useNativeDriver: true,
        }),
      ]);
    };

    // Optimized fast animation sequence
    Animated.sequence([
      // Background image quick fade in
      Animated.timing(bgImageOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      
      Animated.delay(100),
      
      // B appears quickly
      Animated.timing(bFillOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      
      Animated.delay(50),
      
      // Start underline growth when first letter starts
      Animated.parallel([
        // Letters sequence - much faster gaps (70ms)
        Animated.sequence([
          animateLetter(uOpacity, uTranslateY, 0),
          Animated.delay(70),
          animateLetter(lOpacity, lTranslateY, 0),
          Animated.delay(70),
          animateLetter(aOpacity, aTranslateY, 0),
          Animated.delay(70),
          animateLetter(oOpacity, oTranslateY, 0),
        ]),
        // Underline grows as letters appear (synchronized)
        Animated.timing(underlineWidth, {
          toValue: 1,
          duration: 300 + 70 + 300 + 70 + 300 + 70 + 300, // Total time for all letters
          useNativeDriver: false,
        }),
      ]),
      
      Animated.delay(100),
      
      // Progress and hint - faster
      Animated.parallel([
        Animated.timing(progressWidth, {
          toValue: 1,
          duration: 700,
          useNativeDriver: false,
        }),
        Animated.timing(hintOpacity, {
          toValue: 1,
          duration: 300,
          delay: 50,
          useNativeDriver: true,
        }),
      ]),
      
      Animated.delay(200),
      
      // Quick fade out
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete();
    });
  }, []);

  const progressWidthInterpolated = progressWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const underlineWidthInterpolated = underlineWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Background image */}
      <Animated.Image
        source={require('../../assets/images/splash-bg.png')}
        style={[styles.bgImage, { opacity: bgImageOpacity }]}
        resizeMode="cover"
      />
      
      {/* Center Bulao logo */}
      <View style={styles.logoContainer}>
        {/* B Logo without underline */}
        <Animated.View style={[styles.bLogo, { opacity: bFillOpacity }]}>
          <Text style={styles.bLetter}>B</Text>
        </Animated.View>

        {/* "ulao" letters */}
        <View style={styles.textWrapper}>
          <Animated.Text 
            style={[
              styles.letter, 
              { 
                opacity: uOpacity,
                transform: [{ translateY: uTranslateY }],
              }
            ]}
          >
            u
          </Animated.Text>
          <Animated.Text 
            style={[
              styles.letter, 
              { 
                opacity: lOpacity,
                transform: [{ translateY: lTranslateY }],
              }
            ]}
          >
            l
          </Animated.Text>
          <Animated.Text 
            style={[
              styles.letter, 
              { 
                opacity: aOpacity,
                transform: [{ translateY: aTranslateY }],
              }
            ]}
          >
            a
          </Animated.Text>
          <Animated.Text 
            style={[
              styles.letter, 
              { 
                opacity: oOpacity,
                transform: [{ translateY: oTranslateY }],
              }
            ]}
          >
            o
          </Animated.Text>
        </View>
      </View>

      {/* Underline that grows with letter printing */}
      <View style={styles.underlineContainer}>
        <Animated.View 
          style={[
            styles.underline,
            { width: underlineWidthInterpolated }
          ]}
        />
      </View>

      {/* Tagline */}
      <Animated.View style={[styles.hintContainer, { opacity: hintOpacity }]}>
        <Text style={styles.hintText}>CONNECTING PEOPLE</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgImage: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    top: 0,
    left: 0,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bLogo: {
    width: Math.min(Math.max(82, SCREEN_WIDTH * 0.2), 112),
    height: Math.min(Math.max(82, SCREEN_WIDTH * 0.2), 112),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: -28,
    position: 'relative',
  },
  bLetter: {
    fontSize: Math.min(Math.max(66, SCREEN_WIDTH * 0.17), 90),
    fontWeight: '800',
    color: '#0B5145',
    letterSpacing: -3,
  },
  textWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -5,
    marginTop: 8,
  },
  letter: {
    fontSize: Math.min(Math.max(50, SCREEN_WIDTH * 0.13), 76),
    fontWeight: '700',
    color: '#0B5145',
    letterSpacing: -5,
    lineHeight: Math.min(Math.max(50, SCREEN_WIDTH * 0.13), 76) * 0.9,
  },
  underlineContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: 38,
    left: '50%',
    width: Math.min(Math.max(105, SCREEN_WIDTH * 0.27), 155),
    marginLeft: -Math.min(Math.max(52.5, SCREEN_WIDTH * 0.135), 77.5),
    height: 2.5,
    backgroundColor: 'transparent',
    borderRadius: 2,
    overflow: 'hidden',
  },
  underline: {
    height: '100%',
    backgroundColor: '#0B5145',
    borderRadius: 2,
  },
  hintContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: 55,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 9,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: 'rgba(11, 81, 69, 0.32)',
    fontWeight: '600',
  },
});
