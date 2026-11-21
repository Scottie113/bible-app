import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeMorphology } from '@/bible/morphology';
import {
  displayGloss,
  displayOriginal,
  displayTranslit,
  useLexiconEntry,
  type OriginalLanguage,
  type Word,
} from '@/bible/original';
import { formatRef, fromVerseId, type VerseRef } from '@/bible/verse-id';
import { ORIGINAL_FONT } from '@/components/interlinear-verse';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  word: Word | null;
  language: OriginalLanguage;
  verseRef: VerseRef | null;
  /** The word's meaning in the language chosen on the Original tab (besides English). */
  meaning?: { label: string; text: string } | null;
  onClose: () => void;
  onGoToVerse: (ref: VerseRef) => void;
};

/**
 * Everything about one Hebrew or Greek word: what it means here, its grammar,
 * the dictionary entry, how translators usually render it, and where else it
 * appears — so a reader can see *why* it was translated the way it was.
 */
export function WordSheet({ word, language, verseRef, meaning, onClose, onGoToVerse }: Props) {
  const { entry, loaded } = useLexiconEntry(word?.strong);
  const [fullDefinition, setFullDefinition] = useState(false);
  const [allRefs, setAllRefs] = useState(false);

  const close = () => {
    setFullDefinition(false);
    setAllRefs(false);
    onClose();
  };

  const defLines = entry?.def.split('\n') ?? [];
  const refs = entry?.refs ?? [];

  return (
    <Modal visible={!!word} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close word details" />
      <ThemedView style={styles.sheet}>
        <SafeAreaView edges={['bottom']} style={styles.fill}>
          {word && (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <View style={styles.fill}>
                  <ThemedText style={[styles.lemma, { fontFamily: ORIGINAL_FONT }]}>
                    {entry?.lemma ?? displayOriginal(word.text)}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {entry?.translit ?? displayTranslit(word.translit)} · {word.strong}
                  </ThemedText>
                </View>
                <Pressable onPress={close} hitSlop={12} accessibilityRole="button">
                  <ThemedText type="linkPrimary">Close</ThemedText>
                </Pressable>
              </View>

              <Section title={verseRef ? `In ${formatRef(verseRef)}` : 'In this verse'}>
                {/* Hebrew and English on separate lines so right-to-left text doesn't reorder the English. */}
                <ThemedText style={[styles.form, { fontFamily: ORIGINAL_FONT }]}>{displayOriginal(word.text)}</ThemedText>
                <ThemedText style={styles.ltr}>
                  {displayTranslit(word.translit)} — “{displayGloss(word.gloss)}”
                  {meaning ? ` · ${meaning.label}: ${meaning.text ? `“${meaning.text}”` : '(no word for it)'}` : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeMorphology(word.morph, language)}
                </ThemedText>
                {word.variant && (
                  <ThemedText type="small" themeColor="textSecondary">
                    This word is in some Greek manuscripts (such as the Textus Receptus the KJV was translated
                    from) but not in the Nestle-Aland text most modern translations use.
                  </ThemedText>
                )}
              </Section>

              {!loaded ? (
                <ActivityIndicator style={styles.loading} />
              ) : !entry ? (
                <ThemedText themeColor="textSecondary">No dictionary entry for {word.strong}.</ThemedText>
              ) : (
                <>
                  <Section title="Basic meaning">
                    <ThemedText type="smallBold">
                      {entry.gloss}
                      {entry.pos ? `  ·  ${entry.pos}` : ''}
                    </ThemedText>
                  </Section>

                  {!!entry.renderings?.length && (
                    <Section
                      title={`How it is translated (${entry.count} time${entry.count === 1 ? '' : 's'} in the ${
                        language === 'hebrew' ? 'Old' : 'New'
                      } Testament)`}>
                      <View style={styles.chips}>
                        {entry.renderings.map(([text, n]) => (
                          <ThemedView key={text} type="backgroundElement" style={styles.chip}>
                            <ThemedText type="small">
                              {text} <ThemedText type="small" themeColor="textSecondary">×{n}</ThemedText>
                            </ThemedText>
                          </ThemedView>
                        ))}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">
                        English meanings word by word from STEPBible; most common first.
                      </ThemedText>
                    </Section>
                  )}

                  {!!entry.def && (
                    <Section title="Dictionary">
                      {(fullDefinition ? defLines : defLines.slice(0, 6)).map((line, i) => (
                        <ThemedText key={i} type="small" style={styles.defLine}>
                          {line}
                        </ThemedText>
                      ))}
                      {defLines.length > 6 && (
                        <Pressable onPress={() => setFullDefinition(!fullDefinition)} accessibilityRole="button">
                          <ThemedText type="linkPrimary">{fullDefinition ? 'Show less' : 'Show full entry'}</ThemedText>
                        </Pressable>
                      )}
                    </Section>
                  )}

                  {refs.length > 0 && (
                    <Section
                      title={
                        (entry.verses ?? 0) > refs.length
                          ? `Where else it appears (${refs.length} examples from ${entry.verses} verses)`
                          : `Where else it appears (${refs.length} verse${refs.length === 1 ? '' : 's'})`
                      }>
                      <View style={styles.chips}>
                        {(allRefs ? refs : refs.slice(0, 24)).map((id) => {
                          const ref = fromVerseId(id);
                          return (
                            <Pressable
                              key={id}
                              accessibilityRole="link"
                              onPress={() => {
                                close();
                                onGoToVerse(ref);
                              }}>
                              <ThemedView type="backgroundElement" style={styles.chip}>
                                <ThemedText type="small">{formatRef(ref)}</ThemedText>
                              </ThemedView>
                            </Pressable>
                          );
                        })}
                      </View>
                      {refs.length > 24 && (
                        <Pressable onPress={() => setAllRefs(!allRefs)} accessibilityRole="button">
                          <ThemedText type="linkPrimary">
                            {allRefs ? 'Show fewer' : `Show ${refs.length - 24} more`}
                          </ThemedText>
                        </Pressable>
                      )}
                    </Section>
                  )}
                </>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.credit}>
                Hebrew/Greek text, meanings and dictionary: STEPBible.org (CC BY 4.0)
              </ThemedText>
            </ScrollView>
          )}
        </SafeAreaView>
      </ThemedView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '80%',
    minHeight: '45%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  content: { padding: Spacing.four, gap: Spacing.four },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  lemma: { fontSize: 32, lineHeight: 46, fontWeight: 400, textAlign: 'left' },
  form: { fontSize: 22, lineHeight: 34, fontWeight: 400, textAlign: 'left' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  defLine: { fontWeight: 400 },
  loading: { marginVertical: Spacing.four },
  credit: { marginTop: Spacing.two },
});
