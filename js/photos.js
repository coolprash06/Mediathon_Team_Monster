/* =============================================================================
   Rush Hour - photo manifest
   -----------------------------------------------------------------------------
   Every photo on the site is listed here ONCE and tagged twice:
     time      morning-rush | afternoon-rush | peak-rush   -> which desktop shows it
     location  canteen | outdoor | library | classrooms | corridors |
               sports-complex                -> which drawer file holds it
   The desktops and the files both filter this one list, so a lunchtime
   canteen shot appears on the Afternoon Rush screen AND in the Canteen file.

   PLACEHOLDERS: swap each `src` for the real shot (e.g.
   'assets/photos/canteen-01.jpg'), fix its tags, and write a real caption.
   Any aspect ratio works - portrait and landscape are both letterboxed.
   Order within a desktop / file follows the order of this list.
============================================================================= */
(function () {
  'use strict';

  var RH = (window.RushHour = window.RushHour || {});

  RH.photos = [
    { src: 'assets/photos/placeholder-01.svg', time: 'morning-rush', location: 'canteen', caption: 'Placeholder 01 - Canteen, morning rush' },
    { src: 'assets/photos/placeholder-02.svg', time: 'afternoon-rush', location: 'canteen', caption: 'Placeholder 02 - Canteen, afternoon rush' },
    { src: 'assets/photos/placeholder-03.svg', time: 'peak-rush', location: 'canteen', caption: 'Placeholder 03 - Canteen, peak rush' },
    { src: 'assets/photos/placeholder-04.svg', time: 'morning-rush', location: 'canteen', caption: 'Placeholder 04 - Canteen, morning rush' },
    { src: 'assets/photos/placeholder-05.svg', time: 'afternoon-rush', location: 'outdoor', caption: 'Placeholder 05 - Outdoor, afternoon rush' },
    { src: 'assets/photos/placeholder-06.svg', time: 'peak-rush', location: 'outdoor', caption: 'Placeholder 06 - Outdoor, peak rush' },
    { src: 'assets/photos/placeholder-07.svg', time: 'morning-rush', location: 'outdoor', caption: 'Placeholder 07 - Outdoor, morning rush' },
    { src: 'assets/photos/placeholder-08.svg', time: 'afternoon-rush', location: 'outdoor', caption: 'Placeholder 08 - Outdoor, afternoon rush' },
    { src: 'assets/photos/placeholder-09.svg', time: 'peak-rush', location: 'library', caption: 'Placeholder 09 - Library, peak rush' },
    { src: 'assets/photos/placeholder-10.svg', time: 'morning-rush', location: 'library', caption: 'Placeholder 10 - Library, morning rush' },
    { src: 'assets/photos/placeholder-11.svg', time: 'afternoon-rush', location: 'library', caption: 'Placeholder 11 - Library, afternoon rush' },
    { src: 'assets/photos/placeholder-12.svg', time: 'peak-rush', location: 'library', caption: 'Placeholder 12 - Library, peak rush' },
    { src: 'assets/photos/placeholder-13.svg', time: 'morning-rush', location: 'classrooms', caption: 'Placeholder 13 - Classrooms, morning rush' },
    { src: 'assets/photos/placeholder-14.svg', time: 'afternoon-rush', location: 'classrooms', caption: 'Placeholder 14 - Classrooms, afternoon rush' },
    { src: 'assets/photos/placeholder-15.svg', time: 'peak-rush', location: 'classrooms', caption: 'Placeholder 15 - Classrooms, peak rush' },
    { src: 'assets/photos/placeholder-16.svg', time: 'morning-rush', location: 'classrooms', caption: 'Placeholder 16 - Classrooms, morning rush' },
    { src: 'assets/photos/placeholder-17.svg', time: 'afternoon-rush', location: 'corridors', caption: 'Placeholder 17 - Corridors, afternoon rush' },
    { src: 'assets/photos/placeholder-18.svg', time: 'peak-rush', location: 'corridors', caption: 'Placeholder 18 - Corridors, peak rush' },
    { src: 'assets/photos/placeholder-19.svg', time: 'morning-rush', location: 'corridors', caption: 'Placeholder 19 - Corridors, morning rush' },
    { src: 'assets/photos/placeholder-20.svg', time: 'afternoon-rush', location: 'corridors', caption: 'Placeholder 20 - Corridors, afternoon rush' },
    { src: 'assets/photos/placeholder-21.svg', time: 'peak-rush', location: 'sports-complex', caption: 'Placeholder 21 - Sports Complex, peak rush' },
    { src: 'assets/photos/placeholder-22.svg', time: 'morning-rush', location: 'sports-complex', caption: 'Placeholder 22 - Sports Complex, morning rush' },
    { src: 'assets/photos/placeholder-23.svg', time: 'afternoon-rush', location: 'sports-complex', caption: 'Placeholder 23 - Sports Complex, afternoon rush' },
    { src: 'assets/photos/placeholder-24.svg', time: 'peak-rush', location: 'sports-complex', caption: 'Placeholder 24 - Sports Complex, peak rush' }
  ];
})();
