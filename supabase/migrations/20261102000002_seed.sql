-- Starting data: settings, the four cars, and pretend car positions (replaced by Zubie/Smartcar later).
insert into settings (id, data) values (1, $json${"autoLockParkedMinutes": 10, "guestCountdownMinutes": 10, "pickupWindowBeforeMinutes": 30, "pickupWindowAfterMinutes": 120, "guestUnlockRetries": 2, "lateReturnAlertEnabled": true, "lateReturnAlertMinutes": 60, "employeeUnlockScope": "all", "appRelockMinutes": 5, "licenseDueMinutesBefore": 60, "checkoutPhotosDueMinutesAfter": 120, "taskReminderMinutes": 60, "taskPhoneNotifications": true, "checkInMessageTemplate": "Hi {guest}! Your {car} is ready for pickup at our lot. When you arrive, open this link and allow location access, and your car will unlock: {link}\n\nThe link works from {window}. Once it unlocks, start the car within {countdown} minutes or it will lock again (you can unlock it again from the same link).\n\nEnjoy your trip!\n— Valadon Ventures", "homeLot": {"name": "Home lot", "address": "Address TBD (placeholder near LAX)", "polygon": [{"latitude": 33.947, "longitude": -118.385}, {"latitude": 33.947, "longitude": -118.3825}, {"latitude": 33.9455, "longitude": -118.3825}, {"latitude": 33.9455, "longitude": -118.385}]}}$json$::jsonb);
insert into pin_lockout (id) values (1);

insert into cars (id, year, make, model, color) values
  ('gv70', 2026, 'Genesis', 'GV70', '#2E3A4F'),
  ('tx', 2026, 'Lexus', 'TX', '#8C8C8C'),
  ('bmw3', 2026, 'BMW', '3 Series', '#1F4E8C'),
  ('rogue', 2026, 'Nissan', 'Rogue', '#A23B2A');

-- Pretend: all four parked and locked in the home lot.
insert into telemetry (car_id, lat, lng, engine_on, moving, parked_since, lock_state, last_unlocked_at) values
  ('gv70', 33.9466, -118.3843, false, false, now(), 'locked', null),
  ('tx', 33.9459, -118.3832, false, false, now(), 'locked', null),
  ('bmw3', 33.9462, -118.3838, false, false, now(), 'locked', null),
  ('rogue', 33.9464, -118.3829, false, false, now(), 'locked', null);
