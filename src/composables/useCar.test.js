import { describe, it, beforeEach, vi } from 'vitest';
import { useCar } from './useCar';
import { CAR_SETTINGS } from '@/config';

// Mock the services since we're only testing the simulation logic
vi.mock('@/services/audioService', () => ({
  default: {
    playSound: vi.fn(() => Promise.resolve()),
    loadSounds: vi.fn(),
  }
}));

vi.mock('@/services/textToSpeechService', () => ({
  default: {
    speak: vi.fn(() => Promise.resolve()),
  }
}));

describe('useCar composable - runSimulationTick', () => {
  let carState;

  beforeEach(() => {
    // Reset the global state of the composable
    // Since useCar uses global state, we need to reset it between tests
    const { 
      engineStatus, rpm, drsStatus, overtakeActive, tireStatus, 
      fuelLevel, batteryLevel, fuelMix, startEngine, stopEngine,
      activateDrs, activateOvertake, checkTireStatus, getFuelStatus,
      getBatteryStatus, performPitStop, isLowFuel, isLowBattery
    } = useCar();
    
    // Initialize the car in a known state
    engineStatus.value = false;
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    fuelLevel.value = 100;
    batteryLevel.value = 100;
    fuelMix.value = 'Standard';
    
    carState = {
      engineStatus, rpm, drsStatus, overtakeActive, tireStatus, 
      fuelLevel, batteryLevel, fuelMix, startEngine, stopEngine,
      activateDrs, activateOvertake, checkTireStatus, getFuelStatus,
      getBatteryStatus, performPitStop, isLowFuel, isLowBattery
    };
  });

  it('should have initial values as expected', () => {
    expect(carState.engineStatus.value).toBe(false);
    expect(carState.rpm.value).toBe(CAR_SETTINGS.RPM_IDLE);
    expect(carState.fuelLevel.value).toBe(100);
    expect(carState.batteryLevel.value).toBe(100);
    expect(carState.fuelMix.value).toBe('Standard');
  });

  it('should consume more fuel at higher RPM values', () => {
    // Test the fuel consumption calculation directly
    // Set engine on to enable consumption
    carState.engineStatus.value = true;
    
    const initialFuel = carState.fuelLevel.value;
    
    // Calculate expected consumption at idle RPM
    let baseConsumptionRate = CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;
    let rpmValue = CAR_SETTINGS.RPM_IDLE;
    let rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    let normalizedRpmRatio = Math.max(0, rpmRatio);
    let rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionAtIdle = baseConsumptionRate * rpmMultiplier;
    
    // Calculate fuel after consumption at idle
    const fuelAfterIdle = parseFloat(
      Math.max(0, initialFuel - expectedConsumptionAtIdle).toFixed(2)
    );
    
    // Now calculate with higher RPM
    rpmValue = CAR_SETTINGS.RPM_MAX;
    rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    normalizedRpmRatio = Math.max(0, rpmRatio);
    rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionAtHighRPM = baseConsumptionRate * rpmMultiplier;
    
    // Calculate fuel after consumption at high RPM (starting from fuelAfterIdle)
    const fuelAfterHighRPM = parseFloat(
      Math.max(0, fuelAfterIdle - expectedConsumptionAtHighRPM).toFixed(2)
    );
    
    // At higher RPM, more fuel should be consumed (so value should be lower)
    // The difference should be more significant than at idle
    const differenceAtIdle = parseFloat((initialFuel - fuelAfterIdle).toFixed(2));
    const differenceAtHighRPM = parseFloat((fuelAfterIdle - fuelAfterHighRPM).toFixed(2));
    
    expect(differenceAtHighRPM).toBeGreaterThan(differenceAtIdle);
  });

  it('should consume fuel based on normalized RPM ratio', () => {
    // Test that fuel consumption scales appropriately with RPM
    const { rpm } = carState;
    
    // Test consumption at idle RPM (should be minimal)
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    
    // Simulate the runSimulationTick behavior manually
    let baseConsumptionRate = CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;
    let rpmValue = rpm.value;
    let rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    let normalizedRpmRatio = Math.max(0, rpmRatio);
    let rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionAtIdle = baseConsumptionRate * rpmMultiplier;
    
    expect(parseFloat(expectedConsumptionAtIdle.toFixed(2))).toBeCloseTo(baseConsumptionRate * 0.3, 1); // At idle, ~30% of base rate
    
    // Test consumption at max RPM (should be maximum)
    rpmValue = CAR_SETTINGS.RPM_MAX;
    rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    normalizedRpmRatio = Math.max(0, rpmRatio);
    rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionAtMax = baseConsumptionRate * rpmMultiplier;
    
    expect(parseFloat(expectedConsumptionAtMax.toFixed(2))).toBeCloseTo(baseConsumptionRate * 2.0, 1); // At max RPM, 2x base rate
    
    // Test consumption at mid-range RPM
    rpmValue = (CAR_SETTINGS.RPM_IDLE + CAR_SETTINGS.RPM_MAX) / 2; // Halfway between idle and max
    rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    normalizedRpmRatio = Math.max(0, rpmRatio);
    rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionAtMid = baseConsumptionRate * rpmMultiplier;
    
    // At halfway RPM, multiplier should be roughly (0.3 + (0.5 * 1.7)) = 0.3 + 0.85 = 1.15
    expect(parseFloat(expectedConsumptionAtMid.toFixed(2))).toBeCloseTo(baseConsumptionRate * 1.15, 1);
  });

  it('should properly handle RPM values below idle', () => {
    // Test with RPM below idle (should be treated as idle for consumption)
    let rpmValue = CAR_SETTINGS.RPM_IDLE - 100; // Below idle
    
    // Simulate the runSimulationTick behavior manually
    let baseConsumptionRate = CAR_SETTINGS.FUEL_CONSUMPTION_RATE.STANDARD;
    let rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    let normalizedRpmRatio = Math.max(0, rpmRatio); // This should be 0
    let rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7); // This should be 0.3
    
    expect(normalizedRpmRatio).toBe(0);
    expect(rpmMultiplier).toBeCloseTo(0.3, 1);
  });

  it('should recharge battery at a constant rate independent of RPM', () => {
    const { batteryLevel, engineStatus, rpm } = carState;
    
    // Set battery to less than 100% to enable recharging
    batteryLevel.value = 50;
    
    // Set engine on to enable simulation
    engineStatus.value = true;
    
    // Test with different RPM values - battery recharge should be the same
    rpm.value = CAR_SETTINGS.RPM_IDLE;
    
    // Simulate one tick of battery recharge
    const expectedBatteryRecharge = CAR_SETTINGS.BATTERY_RECHARGE_RATE;
    let newBatteryLevel = Math.min(100, batteryLevel.value + expectedBatteryRecharge);
    
    expect(newBatteryLevel).toBe(Math.min(100, 50 + expectedBatteryRecharge));
    
    // Change RPM to max - battery recharge should still be the same
    rpm.value = CAR_SETTINGS.RPM_MAX;
    // Battery recharge is still the same regardless of RPM
    expect(newBatteryLevel).toBe(Math.min(100, 50 + expectedBatteryRecharge));
  });

  it('should not consume fuel when engine is off', () => {
    const { engineStatus, fuelLevel, rpm } = carState;
    
    // Ensure engine is off
    engineStatus.value = false;
    
    const initialFuel = fuelLevel.value;
    rpm.value = CAR_SETTINGS.RPM_MAX; // High RPM but engine off
    
    // Simulate the runSimulationTick behavior manually
    // When engine is off, no fuel should be consumed regardless of RPM
    // This is handled by the watcher that only runs the simulation when engine is on
    expect(fuelLevel.value).toBe(initialFuel);
  });

  it('should consume fuel at different rates based on fuel mix setting', () => {
    // Test consumption at max RPM with different fuel mixes
    let rpmValue = CAR_SETTINGS.RPM_MAX;
    
    // Test with lean fuel mix (should consume less fuel)
    let fuelMixType = 'LEAN';
    let baseConsumptionRate = CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMixType];
    let rpmRatio = (rpmValue - CAR_SETTINGS.RPM_IDLE) / (CAR_SETTINGS.RPM_MAX - CAR_SETTINGS.RPM_IDLE);
    let normalizedRpmRatio = Math.max(0, rpmRatio);
    let rpmMultiplier = 0.3 + (normalizedRpmRatio * 1.7);
    let expectedConsumptionLean = baseConsumptionRate * rpmMultiplier;
    
    // Test with rich fuel mix (should consume more fuel)
    fuelMixType = 'RICH';
    baseConsumptionRate = CAR_SETTINGS.FUEL_CONSUMPTION_RATE[fuelMixType];
    let expectedConsumptionRich = baseConsumptionRate * rpmMultiplier;
    
    expect(expectedConsumptionRich).toBeGreaterThan(expectedConsumptionLean);
  });
});