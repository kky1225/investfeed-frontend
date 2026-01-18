import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import {CardActionArea} from "@mui/material";
import {useNavigate} from "react-router-dom";
import Card from "@mui/material/Card";

export interface SectCardProps {
    id: string,
    title: string,
    value: string,
    fluRt: string,
    trend: 'up' | 'down' | 'neutral',
}

const SectCard = (
    { id, title, value, fluRt, trend }: SectCardProps,
) => {
    const navigate = useNavigate();

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[trend];
    const trendValues = { up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%` };

    const onClick = (id: string) => {
        navigate(`/sect/${id}/list`);
    }

    return (
        <CardActionArea
            onClick={() => onClick(id)}
            sx={{
                height: '100%',
                '&[data-active]': {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                        backgroundColor: 'action.selectedHover',
                    },
                },
            }}
        >
            <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                    <Typography component="h2" variant="subtitle2" gutterBottom>
                        {title}
                    </Typography>
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Stack
                            direction="row"
                            sx={{
                                alignContent: { xs: 'center', sm: 'flex-start' },
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <Typography variant="h4" component="p">
                                {value}
                            </Typography>
                            <Chip size="small" color={color} label={trendValues[trend]} />
                        </Stack>
                    </Stack>
                </CardContent>
            </Card>
        </CardActionArea>
    )
}

export default SectCard;