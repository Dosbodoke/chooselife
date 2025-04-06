import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { Card, CardContent } from '~/components/ui/card';

const allEvents = [
  {
    id: '1',
    month: 'APR',
    day: '15',
    name: 'Highline Festival',
    location: 'Moab, Utah',
  },
  {
    id: '2',
    month: 'MAY',
    day: '22',
    name: 'Beginner Workshop',
    location: 'Boulder, Colorado',
  },
  {
    id: '3',
    month: 'JUN',
    day: '10',
    name: 'Urban Highline Meetup',
    location: 'New York City, NY',
  },
  {
    id: '4',
    month: 'JUL',
    day: '05',
    name: 'Mountain Slackfest',
    location: 'Chamonix, France',
  },
  {
    id: '5',
    month: 'AUG',
    day: '19',
    name: 'Waterline Fun Day',
    location: 'Austin, Texas',
  },
  {
    id: '6',
    month: 'SEP',
    day: '02',
    name: 'Advanced Rigging Clinic',
    location: 'Squamish, BC, Canada',
  },
  {
    id: '7',
    month: 'OCT',
    day: '28',
    name: 'Desert Highline Expedition',
    location: 'Sedona, Arizona',
  },
];

export default function EventsPage() {
  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView>
        <View className="p-4 gap-4">
          {allEvents.map((event) => (
            <Card key={event.id} className="bg-white">
              <CardContent className="p-3">
                <View className="flex-row gap-4 items-center">
                  <View className="flex-col items-center justify-center bg-primary/10 rounded p-2 min-w-[56px]">
                    <Text className="text-sm font-bold text-primary">
                      {event.month}
                    </Text>
                    <Text className="text-xl font-bold text-primary">
                      {event.day}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-medium text-base">{event.name}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {event.location}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
