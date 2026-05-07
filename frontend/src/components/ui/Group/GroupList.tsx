import { View, StyleSheet } from "react-native";
import GroupCard from "../../ui/Group/GroupCard";
import { Group } from "../../../types/group";

type Props = {
    groups: Group[];
    onPress?: (group: Group) => void;
};

export default function GroupList({ groups, onPress }: Props) {
    return (
        <View style={styles.container}>
            {groups.map(group => (
                <GroupCard
                    key={group.groupID}
                    name={group.name}
                    membersCount={group.members.length}
                    recipesCount={group.recipes.length}
                    onPress={() => onPress?.(group)}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: 13, paddingTop: 10 },
});
