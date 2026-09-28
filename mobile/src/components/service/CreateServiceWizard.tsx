import { invalidateServiceQueries } from "../../api/serviceApi";
import { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import type { Location } from "@bulao/domain";
import type { ServiceItem } from "../../features/profile/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../api/client";
import type { Catalog } from "../../api/types";
import { useLocation } from "../../store/location";
import { useAuth } from "../../auth";
import { dash, radii } from "./palette";
import { ServiceCategoryStep } from "./ServiceCategoryStep";
import { ServiceSelectStep } from "./ServiceSelectStep";
import { ServiceDetailsStep } from "./ServiceDetailsStep";
import { ServiceLocationStep } from "./ServiceLocationStep";
import {
  ServiceAvailabilityStep,
  DayKey,
  DaySchedule,
} from "./ServiceAvailabilityStep";
import { ServicePhotosContactStep } from "./ServicePhotosContactStep";
import { ServiceReviewStep } from "./ServiceReviewStep";

type ServiceMode = "doorstep" | "at_center" | "both";
type PricingModel = "fixed" | "hourly" | "visit_quote";

const TOTAL_STEPS = 7;

export function CreateServiceWizard() {
  const insets = useSafeAreaInsets();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const isEditing = !!editId;
  const hydratedId = useRef<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editSchedule, setEditSchedule] = useState(false);
  const { user } = useAuth();
  const storedLocation = useLocation((x) => x.location);
  const [editedLocation, setEditedLocation] = useState<Location | null>(null);
  const location = isEditing ? editedLocation : storedLocation;
  const setLocation = (value: Location) =>
    isEditing
      ? setEditedLocation(value)
      : useLocation.getState().setLocation(value);
  const clearLocation = () =>
    isEditing
      ? setEditedLocation(null)
      : useLocation.getState().clearLocation();
  const client = useQueryClient();

  const [step, setStep] = useState<number>(0);
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const [categoryId, setCategory] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [businessName, setBusinessName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [offeredServices, setOfferedServices] = useState<string[]>([]);
  const [customServices, setCustomServices] = useState<string[]>([]);

  const [serviceMode, setServiceMode] = useState<ServiceMode>("doorstep");
  const [radiusKm, setRadius] = useState<number>(10);
  const [pricingModel, setPricingModel] = useState<PricingModel>("visit_quote");
  const [rateRupees, setRateRupees] = useState<string>("");
  const [operatingHours, setOperatingHours] = useState<string>("");
  const [experienceYears, setExperienceYears] = useState<string>("");

  // Stage 5 State: Availability
  const [is24x7, setIs24x7] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<DayKey[]>([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ]);
  const [hoursMode, setHoursMode] = useState<"same" | "different">("same");
  const [sameFromTime, setSameFromTime] = useState<string>("09:00 AM");
  const [sameToTime, setSameToTime] = useState<string>("07:00 PM");
  const [hasBreakSlot, setHasBreakSlot] = useState<boolean>(false);
  const [breakFromTime, setBreakFromTime] = useState<string>("01:00 PM");
  const [breakToTime, setBreakToTime] = useState<string>("02:00 PM");
  const [daySchedules, setDaySchedules] = useState<Record<DayKey, DaySchedule>>(
    {
      Mon: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Tue: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Wed: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Thu: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Fri: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Sat: { closed: false, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
      Sun: { closed: true, slots: [{ from: "09:00 AM", to: "07:00 PM" }] },
    },
  );
  const [operatingHoursSummary, setOperatingHoursSummary] = useState<string>(
    "Mon - Sat: 09:00 AM - 07:00 PM",
  );

  // Stage 6 State: Photos, Contact & Online Presence
  const [servicePhotos, setServicePhotos] = useState<string[]>([]);
  const [shopPhotos, setShopPhotos] = useState<string[]>([]);
  const [phoneVisible, setPhoneVisible] = useState<boolean>(false);
  const [website, setWebsite] = useState<string>("");
  const [instagram, setInstagram] = useState<string>("");
  const [facebook, setFacebook] = useState<string>("");

  const [errorMsg, setErrorMsg] = useState<string>("");

  const catalogQuery = useQuery({
    queryKey: ["categories", "service-catalog-v2"],
    queryFn: () => api<Catalog>("/categories?catalog=service-v2"),
    refetchOnMount: "always",
  });

  const editQuery = useQuery({
    queryKey: ["my-services", user?.id, "edit"],
    enabled: isEditing && !!user,
    queryFn: () => api<ServiceItem[]>("/services/mine"),
  });
  const existingService = editQuery.data?.find((item) => item.id === editId);
  useEffect(() => {
    if (!existingService || hydratedId.current === existingService.id) return;
    hydratedId.current = existingService.id;
    const saved = existingService.wizardState || {};
    setCategory(existingService.categoryId);
    setServiceId(saved.serviceId || "");
    setTitle(existingService.title || "");
    setBusinessName(saved.businessName || "");
    setDescription(existingService.description || "");
    setOfferedServices(saved.offeredServices || []);
    setCustomServices(
      saved.customServices ||
        (saved.offeredServices ? [] : existingService.offeredServices || []),
    );
    setServiceMode(existingService.serviceMode);
    setRadius(existingService.radiusKm);
    setPricingModel(existingService.pricingModel || "visit_quote");
    setRateRupees(
      existingService.basePricePaise
        ? String(existingService.basePricePaise / 100)
        : "",
    );
    setExperienceYears(String(existingService.experienceYears ?? 0));
    setOperatingHours(existingService.operatingHours || "");
    setOperatingHoursSummary(existingService.operatingHours || "");
    setServicePhotos(
      saved.servicePhotos || existingService.portfolioUrls || [],
    );
    setShopPhotos(saved.shopPhotos || []);
    setPhoneVisible(!!existingService.phoneVisible);
    setWebsite(saved.website || "");
    setInstagram(saved.instagram || "");
    setFacebook(saved.facebook || "");
    if (
      typeof existingService.latitude === "number" &&
      typeof existingService.longitude === "number"
    )
      setEditedLocation({
        area: existingService.area,
        latitude: existingService.latitude,
        longitude: existingService.longitude,
      });
    if (saved.daySchedules && saved.selectedDays) {
      setIs24x7(!!saved.is24x7);
      setSelectedDays(saved.selectedDays);
      setHoursMode(saved.hoursMode || "same");
      setSameFromTime(saved.sameFromTime || "09:00 AM");
      setSameToTime(saved.sameToTime || "07:00 PM");
      setHasBreakSlot(!!saved.hasBreakSlot);
      setBreakFromTime(saved.breakFromTime || "01:00 PM");
      setBreakToTime(saved.breakToTime || "02:00 PM");
      setDaySchedules(saved.daySchedules);
      setEditSchedule(true);
    }
    setStep(2);
    setHydrated(true);
  }, [existingService]);
  const selectedCategory =
    catalogQuery.data?.categories.find((c) => c.id === categoryId) ||
    (existingService && existingService.categoryId === categoryId
      ? {
          id: categoryId,
          name: existingService.categoryName,
          icon: existingService.categoryIcon,
          kind: "service",
        }
      : undefined);

  const handleToggleOfferedService = (optionId: string) => {
    if (offeredServices.includes(optionId)) {
      setOfferedServices(offeredServices.filter((id) => id !== optionId));
    } else {
      setOfferedServices([...offeredServices, optionId]);
    }
  };

  const handleAddCustomService = (customName: string) => {
    if (!customServices.includes(customName)) {
      setCustomServices((prev) => [...prev, customName]);
    }
  };

  const handleRemoveCustomService = (customName: string) => {
    setCustomServices((prev) => prev.filter((s) => s !== customName));
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (
        !location ||
        !location.area ||
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        throw new Error(
          "Service location is required. Please set your location in Step 4.",
        );
      }
      const parsedRate = Number(rateRupees);
      if (
        pricingModel !== "visit_quote" &&
        (!rateRupees.trim() || !Number.isFinite(parsedRate) || parsedRate <= 0)
      )
        throw new Error("Enter a valid price or choose Quote on request.");
      const basePricePaise =
        !isNaN(parsedRate) && parsedRate > 0
          ? Math.round(parsedRate * 100)
          : undefined;
      if (!experienceYears.trim()) throw new Error("Enter your years of experience (0 if you are starting out).");
      const parsedExp = Number(experienceYears);
      if (!Number.isInteger(parsedExp) || parsedExp < 0 || parsedExp > 70)
        throw new Error("Experience must be a whole number between 0 and 70.");
      const experience = !isNaN(parsedExp) && parsedExp > 0 ? parsedExp : 0;
      const payload = {
        latitude: location.latitude,
        longitude: location.longitude,
        area: location.area,
        categoryId,
        wizardState: {
          serviceId,
          businessName,
          offeredServices,
          customServices,
          servicePhotos: servicePhotos.filter(uri => /^https?:\/\//i.test(uri)),
          shopPhotos: shopPhotos.filter(uri => /^https?:\/\//i.test(uri)),
          website,
          instagram,
          facebook,
          ...(!isEditing || editSchedule
            ? {
                is24x7,
                selectedDays,
                hoursMode,
                sameFromTime,
                sameToTime,
                hasBreakSlot,
                breakFromTime,
                breakToTime,
                daySchedules,
              }
            : {}),
        },
        title: title.trim() || undefined,
        businessName: businessName.trim() || undefined,
        description: description.trim(),
        offeredServices: [...offeredServices, ...customServices],
        serviceMode: serviceMode || undefined,
        radiusKm: Number(radiusKm) || 10,
        pricingModel,
        basePricePaise:
          pricingModel === "visit_quote" ? 0 : basePricePaise || 0,
        operatingHours: operatingHoursSummary.trim(),
        experience,
        portfolioUrls: servicePhotos,
        shopPhotos: shopPhotos.length > 0 ? shopPhotos : [],
        phoneVisible,
        website: website.trim(),
        instagram: instagram.trim(),
        facebook: facebook.trim(),
        available: existingService?.available ?? true,
      };
      return api<{ id: string }>(
        isEditing ? `/services/${editId}` : "/services",
        payload,
        isEditing ? "PATCH" : "POST",
      );
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["nearby"] });
      client.invalidateQueries({ queryKey: ["myServices"] });
      void invalidateServiceQueries(client);
    },
    onError: (err: any) => {
      console.error("[CreateServiceWizard] publish error:", err);
    },
  });

  const canGoNext = () => {
    if (step === 0) return Boolean(selectedCategory);
    if (step === 1) return Boolean(serviceId);
    if (step === 2) {
      const hasTitle = Boolean(title.trim());
      const hasOffered =
        offeredServices.length > 0 || customServices.length > 0;
      return hasTitle && hasOffered;
    }
    if (step === 3) {
      return Boolean(
        location?.area &&
          typeof location.latitude === "number" &&
          typeof location.longitude === "number",
      );
    }
    if (step === 4) return true; // Availability step validation handles internally
    if (step === 5) return true; // Photos & Contact step is optional
    return true;
  };

  const handleNext = () => {
    setErrorMsg("");
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      publishMutation.mutate();
    }
  };

  const handleCategorySelect = (catId: string) => {
    setCategory(catId);
    setServiceId("");
    setTitle("");
    setBusinessName("");
    setDescription("");
    setOfferedServices([]);
    setCustomServices([]);
  };

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={dash.text} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Service" : "Create Service"}
          </Text>
        </View>
        <View style={styles.unauthContent}>
          <Ionicons
            name="shield-checkmark-outline"
            size={64}
            color={dash.primary}
          />
          <Text style={styles.unauthTitle}>Sign in to Offer Services</Text>
          <Text style={styles.unauthSub}>
            Create your professional profile and connect with customers nearby.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isEditing && (!hydrated || editQuery.isError || !existingService)) {
    return (
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + 24, paddingHorizontal: 20 },
        ]}
      >
        <Pressable onPress={() => router.back()}>
          <Text>Back</Text>
        </Pressable>
        {editQuery.isPending || (!!existingService && !hydrated) ? (
          <ActivityIndicator color={dash.primary} />
        ) : (
          <>
            <Text style={styles.headerTitle}>
              {editQuery.isError
                ? "Couldn't load your service"
                : "Service not found in your account"}
            </Text>
            {editQuery.isError && (
              <Pressable onPress={() => void editQuery.refetch()}>
                <Text>Try again</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    );
  }

  if (publishMutation.isSuccess) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <View style={styles.successContent}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark-circle" size={80} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>
            {isEditing ? "Service Updated!" : "Service Published! 🎉"}
          </Text>
          <Text style={styles.successSub}>
            {isEditing
              ? "Your changes have been saved to this service."
              : `Your service profile is now live in ${location?.area || "your area"}.`}
          </Text>
          <View style={{ width: "100%", gap: 12, marginTop: 12 }}>
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                router.replace({
                  pathname: "/service-profile",
                  params: { serviceId: publishMutation.data.id },
                })
              }
            >
              <Text style={styles.primaryBtnText}>View My Service</Text>
            </Pressable>
            <Pressable
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: "#FFFFFF",
                  borderWidth: 1.5,
                  borderColor: "#E2E8F0",
                },
              ]}
              onPress={() => router.replace("/service-home")}
            >
              <Text style={[styles.primaryBtnText, { color: "#0F172A" }]}>
                Go to Dashboard
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step > 0 ? "Previous step" : "Close"}
          onPress={() => (step > 0 ? setStep(step - 1) : router.back())}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Service" : "Create Service"}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isEditing
              ? "Update your saved service details"
              : "Set up your service profile"}
          </Text>
        </View>
        <View style={styles.stepBadge}>
          <Text style={styles.stepIndicator}>
            Step {step + 1} of {TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View accessibilityRole="progressbar" style={styles.progressBarTrack}>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index <= step && styles.progressBarFill,
            ]}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* STEP 0: Select Category */}
        {step === 0 && (
          <ServiceCategoryStep
            categories={
              catalogQuery.data?.categories.filter(
                (category) => category.kind === "service",
              ) ?? []
            }
            selectedId={categoryId}
            onSelect={handleCategorySelect}
            loading={catalogQuery.isLoading}
            failed={catalogQuery.isError}
            onRetry={() => {
              void catalogQuery.refetch();
            }}
          />
        )}

        {/* STEP 1: Select Specific Service */}
        {step === 1 && selectedCategory && (
          <ServiceSelectStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            selectedServiceId={serviceId}
            onServiceSelect={(id) => {
              setServiceId(id);
              setOfferedServices([]);
              setCustomServices([]);
            }}
            onChangeCategory={() => setStep(0)}
          />
        )}

        {/* STEP 2: Service Details */}
        {step === 2 && selectedCategory && (
          <ServiceDetailsStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            serviceId={serviceId}
            serviceName={title || undefined}
            title={title}
            onTitleChange={setTitle}
            businessName={businessName}
            onBusinessNameChange={setBusinessName}
            description={description}
            onDescriptionChange={setDescription}
            selectedOfferedServices={offeredServices}
            onToggleOfferedService={handleToggleOfferedService}
            customServices={customServices}
            onAddCustomService={handleAddCustomService}
            onRemoveCustomService={handleRemoveCustomService}
            onChangeService={() => setStep(1)}
            onChangeCategory={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <View
            style={{
              gap: 12,
              padding: 16,
              backgroundColor: "white",
              borderRadius: 16,
              marginTop: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#034E3B" }}>
              Pricing & experience
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(
                [
                  ["visit_quote", "Quote on request"],
                  ["fixed", "Fixed price"],
                  ["hourly", "Hourly"],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => setPricingModel(value)}
                  style={{
                    padding: 10,
                    borderRadius: 9,
                    backgroundColor:
                      pricingModel === value ? "#034E3B" : "#F1F4F3",
                  }}
                >
                  <Text
                    style={{
                      color: pricingModel === value ? "white" : "#034E3B",
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {pricingModel !== "visit_quote" && (
              <TextInput
                accessibilityLabel="Starting price in rupees"
                value={rateRupees}
                onChangeText={setRateRupees}
                placeholder="Starting price (₹)"
                keyboardType="decimal-pad"
                style={{
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#D6E2DD",
                  borderRadius: 10,
                }}
              />
            )}
            <Text style={{ fontWeight: "600" }}>Years of experience</Text>
            <TextInput
              accessibilityLabel="Years of experience"
              value={experienceYears}
              onChangeText={setExperienceYears}
              keyboardType="number-pad"
              style={{
                padding: 12,
                borderWidth: 1,
                borderColor: "#D6E2DD",
                borderRadius: 10,
              }}
            />
          </View>
        )}
        {/* STEP 3: Service Location & Service Mode */}
        {step === 3 && selectedCategory && (
          <ServiceLocationStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            serviceId={serviceId}
            serviceMode={serviceMode}
            onServiceModeChange={setServiceMode}
            radiusKm={radiusKm}
            onRadiusKmChange={setRadius}
            location={location}
            onLocationChange={(loc) => {
              if (loc) {
                setLocation(loc);
              } else {
                clearLocation();
              }
            }}
            onChangeService={() => setStep(1)}
            onChangeCategory={() => setStep(0)}
          />
        )}

        {/* STEP 4: Stage 5 Availability */}
        {step === 4 && isEditing && !editSchedule && (
          <View style={{ gap: 16, padding: 16 }}>
            <Text style={styles.headerTitle}>Saved operating hours</Text>
            <TextInput
              value={operatingHoursSummary}
              onChangeText={setOperatingHoursSummary}
              maxLength={100}
              style={{
                padding: 14,
                backgroundColor: "white",
                borderRadius: 12,
              }}
            />
            <Text>
              Your saved hours will stay unchanged unless you edit them.
            </Text>
            <Pressable onPress={() => setEditSchedule(true)}>
              <Text>Set a weekly schedule</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={() => setStep(5)}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          </View>
        )}
        {step === 4 && selectedCategory && (!isEditing || editSchedule) && (
          <ServiceAvailabilityStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            serviceId={serviceId}
            serviceName={title || undefined}
            is24x7={is24x7}
            onIs24x7Change={setIs24x7}
            selectedDays={selectedDays}
            onSelectedDaysChange={setSelectedDays}
            hoursMode={hoursMode}
            onHoursModeChange={setHoursMode}
            sameFromTime={sameFromTime}
            onSameFromTimeChange={setSameFromTime}
            sameToTime={sameToTime}
            onSameToTimeChange={setSameToTime}
            hasBreakSlot={hasBreakSlot}
            onHasBreakSlotChange={setHasBreakSlot}
            breakFromTime={breakFromTime}
            onBreakFromTimeChange={setBreakFromTime}
            breakToTime={breakToTime}
            onBreakToTimeChange={setBreakToTime}
            daySchedules={daySchedules}
            onDaySchedulesChange={setDaySchedules}
            onOperatingHoursSummaryChange={setOperatingHoursSummary}
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
            onChangeService={() => setStep(1)}
            onChangeCategory={() => setStep(0)}
          />
        )}

        {/* STEP 5: Photos, Contact & Online Presence */}
        {step === 5 && selectedCategory && (
          <ServicePhotosContactStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            serviceId={serviceId}
            serviceName={title || undefined}
            serviceMode={serviceMode}
            userPhone={user?.phone}
            servicePhotos={servicePhotos}
            onServicePhotosChange={setServicePhotos}
            shopPhotos={shopPhotos}
            onShopPhotosChange={setShopPhotos}
            phoneVisible={phoneVisible}
            onPhoneVisibleChange={setPhoneVisible}
            website={website}
            onWebsiteChange={setWebsite}
            instagram={instagram}
            onInstagramChange={setInstagram}
            facebook={facebook}
            onFacebookChange={setFacebook}
            onChangeService={() => setStep(1)}
            onChangeCategory={() => setStep(0)}
            onNext={handleNext}
            onSkip={handleNext}
          />
        )}

        {/* STEP 6: Review & Publish */}
        {step === 6 && selectedCategory && (
          <ServiceReviewStep
            categoryId={categoryId}
            categoryName={selectedCategory.name}
            categoryIcon={selectedCategory.icon}
            serviceId={serviceId}
            serviceName={title || undefined}
            title={title}
            businessName={businessName}
            description={description}
            offeredServices={offeredServices}
            customServices={customServices}
            serviceMode={serviceMode}
            radiusKm={radiusKm}
            location={location}
            operatingHours={operatingHoursSummary}
            servicePhotos={servicePhotos}
            shopPhotos={shopPhotos}
            phoneVisible={phoneVisible}
            userPhone={user?.phone}
            website={website}
            instagram={instagram}
            facebook={facebook}
            onEditStep={(targetStep) => setStep(targetStep)}
            onPublish={() => publishMutation.mutate()}
            onBack={() => setStep(5)}
            isPublishing={publishMutation.isPending}
            isEditing={isEditing}
            publishError={(publishMutation.error as Error)?.message}
          />
        )}
      </ScrollView>

      {/* Sticky Footer for steps 0-3 and step 5 */}
      {(step < 4 || step === 5) && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {step === 0 && (
            <View
              style={styles.selectionSummary}
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name={selectedCategory ? "checkmark-circle" : "ellipse-outline"}
                size={17}
                color={selectedCategory ? "#15803D" : dash.subtext}
              />
              <Text style={styles.selectionSummaryText}>
                {selectedCategory
                  ? `${selectedCategory.name} selected`
                  : "Select a category to continue"}
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue to next step"
            accessibilityState={{
              disabled: !canGoNext() || publishMutation.isPending,
            }}
            style={[
              styles.primaryBtn,
              !canGoNext() && styles.primaryBtnDisabled,
            ]}
            disabled={!canGoNext() || publishMutation.isPending}
            onPress={handleNext}
          >
            {publishMutation.isPending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          {step === 5 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip photos and contact step"
              style={styles.skipBtn}
              onPress={handleNext}
            >
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAF6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    minHeight: 64,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  headerSubtitle: { fontSize: 12, color: "#64748B", marginTop: 1 },
  stepBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  stepIndicator: { fontSize: 11.5, fontWeight: "700", color: "#475569" },
  progressBarTrack: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    marginTop: 6,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
  },
  progressBarFill: { backgroundColor: "#15803D" },
  scrollContent: { padding: 20, paddingTop: 24, paddingBottom: 28 },
  stepWrapper: { gap: 16 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: dash.text,
    letterSpacing: -0.3,
  },
  sectionSub: { fontSize: 14, color: dash.subtext, marginTop: -8 },
  fieldGroup: { gap: 8, marginTop: 8 },
  label: { fontSize: 14, fontWeight: "700", color: dash.text },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: dash.text,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  radiusChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    minHeight: 46,
    justifyContent: "center",
  },
  radiusChipSelected: {
    backgroundColor: dash.primary,
    borderColor: dash.primary,
  },
  radiusChipText: { fontSize: 14, fontWeight: "600", color: dash.text },
  radiusChipTextSelected: { color: "#FFFFFF" },
  pricingModelRow: { flexDirection: "row", gap: 8 },
  pmChip: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
  },
  pmChipSelected: { backgroundColor: dash.primary, borderColor: dash.primary },
  pmChipText: { fontSize: 13, fontWeight: "700", color: dash.text },
  pmChipTextSelected: { color: "#FFFFFF" },
  currencyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: "700",
    color: dash.primary,
    marginRight: 8,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "700",
    color: dash.text,
  },
  portfolioGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  portfolioCard: {
    width: 105,
    height: 105,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2.5,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  portfolioCardSelected: { borderColor: dash.primary },
  portfolioImg: { width: "100%", height: "100%" },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: dash.primary,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.md,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  reviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewLabel: { fontSize: 14, color: dash.subtext },
  reviewValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
    color: dash.text,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FDECEC",
    padding: 12,
    borderRadius: radii.md,
  },
  errorText: { fontSize: 14, color: dash.error, fontWeight: "600" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#F8FAF6",
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  primaryBtn: {
    backgroundColor: "#15803D",
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { backgroundColor: "#94A3B8" },
  selectionSummary: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
  },
  selectionSummaryText: {
    flexShrink: 1,
    fontSize: 12,
    color: "#15803D",
    fontWeight: "600",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  skipBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  unauthContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 16,
  },
  unauthTitle: { fontSize: 20, fontWeight: "800", color: dash.text },
  unauthSub: {
    fontSize: 14,
    color: dash.subtext,
    textAlign: "center",
    marginBottom: 10,
  },
  successContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 16,
  },
  successBadge: { marginBottom: 10 },
  successTitle: { fontSize: 24, fontWeight: "800", color: dash.text },
  successSub: {
    fontSize: 15,
    color: dash.subtext,
    textAlign: "center",
    marginBottom: 20,
  },
});
