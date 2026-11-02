import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Bouncy, glassFx, isGlass, radius } from './bubble';
import { colors } from './components';
import { NoSwipeZone } from './motion';

/** True when every word of the query appears in one of the fields (case-insensitive). */
export function matchesQuery(query: string, ...fields: (string | number | null | undefined)[]) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields
    .filter((f) => f !== null && f !== undefined)
    .join(' ')
    .toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** Search field with a magnifier and a clear button. Grows with the fleet: cars, guests, plates… */
export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <NoSwipeZone>
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            height: 44,
            paddingHorizontal: 12,
            borderRadius: isGlass() ? 999 : radius(),
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          },
          glassFx(),
        ]}
      >
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={placeholder}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, fontSize: 15, color: colors.text, paddingVertical: 0, outlineStyle: 'none' } as object}
        />
        {value ? (
          <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </NoSwipeZone>
  );
}

export type FilterOption<K extends string> = { key: K; label: string; count?: number; tone?: 'warn' };

/** One row of single-choice filter chips that scrolls sideways when there are many. */
export function FilterChips<K extends string>({ options, value, onChange }: { options: FilterOption<K>[]; value: K; onChange: (k: K) => void }) {
  return (
    <NoSwipeZone>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} accessibilityRole="tablist">
        {options.map((o) => {
          const active = o.key === value;
          const warn = o.tone === 'warn' && !!o.count;
          return (
            <Bouncy
              key={o.key}
              onPress={() => onChange(o.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${o.label}${o.count !== undefined ? `, ${o.count}` : ''}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                height: 34,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? colors.primary : colors.card,
                borderWidth: 1,
                borderColor: active ? colors.primary : warn ? colors.unlocked : colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: active ? colors.primaryText : warn ? colors.unlocked : colors.text }}>{o.label}</Text>
              {o.count !== undefined ? (
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.primaryText : colors.muted, opacity: active ? 0.85 : 1 }}>{o.count}</Text>
              ) : null}
            </Bouncy>
          );
        })}
      </ScrollView>
    </NoSwipeZone>
  );
}

/** Shown when a search or filter leaves nothing. */
export function NoMatches({ what, onClear }: { what: string; onClear: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
      <Ionicons name="search-outline" size={24} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 14 }}>No {what} match.</Text>
      <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>Clear search and filters</Text>
      </Pressable>
    </View>
  );
}
