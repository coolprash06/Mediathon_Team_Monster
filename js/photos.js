/* =============================================================================
   Rush Hour - photo manifest
   -----------------------------------------------------------------------------
   Every photo on the site is listed here ONCE and tagged twice:
     time      morning-rush | afternoon-rush | peak-rush   -> which desktop shows it
     location  canteen | outdoor | mini-mart | student-lounge | corridors |
               sports-complex                -> which drawer file holds it
   The desktops and the files both filter this one list, so a lunchtime
   canteen shot appears on the Afternoon Rush screen AND in the Canteen file.

   All site-ready photographs live in `assets/photos/rush-##.jpg`.
   Their original source filename, classifications, and capture details are
   tracked in `pics.md`.
   Any aspect ratio works - portrait and landscape are both letterboxed.
   Order within a desktop / file follows the order of this list.
============================================================================= */
(function () {
  'use strict';

  var RH = (window.RushHour = window.RushHour || {});

  RH.photos = [
    { src: 'assets/photos/rush-01.jpg', time: 'morning-rush', location: 'student-lounge', caption: 'Students settling into the student lounge' },
    { src: 'assets/photos/rush-02.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'A shaded campus walkway between classes' },
    { src: 'assets/photos/rush-03.jpg', time: 'peak-rush', location: 'mini-mart', caption: 'Crowd gathering outside Mini Mart' },
    { src: 'assets/photos/rush-04.jpg', time: 'peak-rush', location: 'corridors', caption: 'Students bunching at a corridor junction' },
    { src: 'assets/photos/rush-05.jpg', time: 'peak-rush', location: 'corridors', caption: 'Busy clinic corridor during the rush' },
    { src: 'assets/photos/rush-06.jpg', time: 'morning-rush', location: 'outdoor', caption: 'Morning calm around the campus roundabout' },
    { src: 'assets/photos/rush-07.jpg', time: 'afternoon-rush', location: 'sports-complex', caption: 'Sports festival activity in the gym' },
    { src: 'assets/photos/rush-08.jpg', time: 'afternoon-rush', location: 'sports-complex', caption: 'Table tennis players at the sports festival' },
    { src: 'assets/photos/rush-09.jpg', time: 'morning-rush', location: 'corridors', caption: 'Students moving through a morning corridor' },
    { src: 'assets/photos/rush-10.jpg', time: 'afternoon-rush', location: 'sports-complex', caption: 'Spectators and players in the sports hall' },
    { src: 'assets/photos/rush-11.jpg', time: 'afternoon-rush', location: 'student-lounge', caption: 'Students occupying the student lounge' },
    { src: 'assets/photos/rush-12.jpg', time: 'afternoon-rush', location: 'student-lounge', caption: 'Foot traffic through the lounge' },
    { src: 'assets/photos/rush-13.jpg', time: 'peak-rush', location: 'corridors', caption: 'A queue building by the stairwell' },
    { src: 'assets/photos/rush-14.jpg', time: 'peak-rush', location: 'outdoor', caption: 'Students queuing at an outdoor stall' },
    { src: 'assets/photos/rush-15.jpg', time: 'peak-rush', location: 'outdoor', caption: 'Crowd gathered around the outdoor kiosk' },
    { src: 'assets/photos/rush-16.jpg', time: 'morning-rush', location: 'student-lounge', caption: 'Early activity in the student lounge' },
    { src: 'assets/photos/rush-17.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'Students crossing the shaded walkway' },
    { src: 'assets/photos/rush-18.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'Outdoor stalls drawing foot traffic' },
    { src: 'assets/photos/rush-19.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'Students walking between campus buildings' },
    { src: 'assets/photos/rush-20.jpg', time: 'afternoon-rush', location: 'canteen', caption: 'A packed canteen at lunchtime' },
    { src: 'assets/photos/rush-21.jpg', time: 'afternoon-rush', location: 'canteen', caption: 'Students eating through the lunch rush' },
    { src: 'assets/photos/rush-22.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'Students on the move outdoors' },
    { src: 'assets/photos/rush-23.jpg', time: 'peak-rush', location: 'canteen', caption: 'Queue at the food counter during peak rush' },
    { src: 'assets/photos/rush-24.jpg', time: 'afternoon-rush', location: 'student-lounge', caption: 'Groups meeting in the student lounge' },
    { src: 'assets/photos/rush-25.jpg', time: 'afternoon-rush', location: 'student-lounge', caption: 'Lounge seating filling through the afternoon' },
    { src: 'assets/photos/rush-26.jpg', time: 'afternoon-rush', location: 'student-lounge', caption: 'Students passing through the lounge' },
    { src: 'assets/photos/rush-27.jpg', time: 'peak-rush', location: 'mini-mart', caption: 'Crowd outside Mini Mart' },
    { src: 'assets/photos/rush-28.jpg', time: 'peak-rush', location: 'sports-complex', caption: 'Crowd gathering for the sports festival' },
    { src: 'assets/photos/rush-29.jpg', time: 'peak-rush', location: 'outdoor', caption: 'Outdoor crowd moving between buildings' },
    { src: 'assets/photos/rush-30.jpg', time: 'afternoon-rush', location: 'outdoor', caption: 'Campus walkway at lunchtime' },
    { src: 'assets/photos/rush-31.jpg', time: 'peak-rush', location: 'outdoor', caption: 'Students converging at the outdoor stalls' },
    { src: 'assets/photos/rush-32.jpg', time: 'afternoon-rush', location: 'canteen', caption: 'Students seated in the canteen' },
    { src: 'assets/photos/rush-33.jpg', time: 'afternoon-rush', location: 'canteen', caption: 'Canteen tables during the lunch rush' }
  ];
})();
