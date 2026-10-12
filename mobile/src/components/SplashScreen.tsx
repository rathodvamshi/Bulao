import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, Image } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const splashFontSize = Math.min(Math.max(50, SCREEN_WIDTH * 0.13), 76);
const splashPinSize = Math.round(splashFontSize * 0.58);
const splashHoleSize = Math.max(6, Math.round(splashPinSize * 0.36));
const splashTipHalfWidth = Math.max(4, Math.round(splashPinSize * 0.2));
const splashTipHeight = Math.max(5, Math.round(splashPinSize * 0.25));
const splashPinMarginLeft = Math.max(3, Math.round(splashFontSize * 0.08));
const splashPinMarginTop = Math.max(4, Math.round(splashFontSize * 0.1));

// Speech rays (/// radiating diagonally upward-right)
const splashStrokeW = Math.max(1.4, Math.round(splashFontSize * 0.042 * 10) / 10);
const splashCx = splashPinSize / 2;
const splashCy = splashPinSize / 2;
const splashRayGap = Math.max(2.5, Math.round(splashFontSize * 0.065));
const splashRStart = splashPinSize / 2 + splashRayGap;
const splashLenSide = Math.max(5.5, Math.round(splashPinSize * 0.28));
const splashLenMid = Math.max(8, Math.round(splashPinSize * 0.40));

const splashDegToRad = Math.PI / 180;
const splashA1Deg = 26;
const splashA2Deg = 45;
const splashA3Deg = 64;

const splashA1 = splashA1Deg * splashDegToRad;
const splashA2 = splashA2Deg * splashDegToRad;
const splashA3 = splashA3Deg * splashDegToRad;

const splashRMid1 = splashRStart + splashLenSide / 2;
const splashX1 = splashCx + splashRMid1 * Math.cos(splashA1);
const splashY1 = splashCy - splashRMid1 * Math.sin(splashA1);

const splashRMid2 = splashRStart + splashLenMid / 2;
const splashX2 = splashCx + splashRMid2 * Math.cos(splashA2);
const splashY2 = splashCy - splashRMid2 * Math.sin(splashA2);

const splashRMid3 = splashRStart + splashLenSide / 2;
const splashX3 = splashCx + splashRMid3 * Math.cos(splashA3);
const splashY3 = splashCy - splashRMid3 * Math.sin(splashA3);



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
          <Animated.View
            style={[
              styles.pinWrap,
              {
                width: splashPinSize,
                marginLeft: splashPinMarginLeft,
                marginTop: splashPinMarginTop,
                opacity: oOpacity,
                transform: [{ translateY: oTranslateY }],
              },
            ]}
          >
            {/* Three Separate Expressive Speech Rays (/// radiating outward) */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View
                style={[
                  styles.speechRay,
                  {
                    width: splashLenSide,
                    height: splashStrokeW,
                    borderRadius: splashStrokeW / 2,
                    backgroundColor: '#20BF86',
                    left: splashX1 - splashLenSide / 2,
                    top: splashY1 - splashStrokeW / 2,
                    transform: [{ rotate: `-${splashA1Deg}deg` }],
                  },
                ]}
              />
              <View
                style={[
                  styles.speechRay,
                  {
                    width: splashLenMid,
                    height: splashStrokeW,
                    borderRadius: splashStrokeW / 2,
                    backgroundColor: '#20BF86',
                    left: splashX2 - splashLenMid / 2,
                    top: splashY2 - splashStrokeW / 2,
                    transform: [{ rotate: `-${splashA2Deg}deg` }],
                  },
                ]}
              />
              <View
                style={[
                  styles.speechRay,
                  {
                    width: splashLenSide,
                    height: splashStrokeW,
                    borderRadius: splashStrokeW / 2,
                    backgroundColor: '#20BF86',
                    left: splashX3 - splashLenSide / 2,
                    top: splashY3 - splashStrokeW / 2,
                    transform: [{ rotate: `-${splashA3Deg}deg` }],
                  },
                ]}
              />
            </View>

            <View
              style={[
                styles.pinCircle,
                {
                  width: splashPinSize,
                  height: splashPinSize,
                  borderRadius: splashPinSize / 2,
                  backgroundColor: '#0B5145',
                },
              ]}
            >
              <View
                style={[
                  styles.pinHole,
                  {
                    width: splashHoleSize,
                    height: splashHoleSize,
                    borderRadius: splashHoleSize / 2,
                  },
                ]}
              />
            </View>
            <View
              style={[
                styles.pinPointer,
                {
                  borderLeftWidth: splashTipHalfWidth,
                  borderRightWidth: splashTipHalfWidth,
                  borderTopWidth: splashTipHeight,
                  borderTopColor: '#0B5145',
                },
              ]}
            />
          </Animated.View>
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
        <Text style={styles.hintText}>LOCAL WORK &amp; SERVICES, ON DEMAND</Text>
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
  pinWrap: {
    alignItems: 'center',
  },
  speechRay: {
    position: 'absolute',
  },
  pinCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinHole: {
    backgroundColor: '#FAF8F2',
  },
  pinPointer: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
